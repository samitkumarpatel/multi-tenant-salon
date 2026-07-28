locals {
  common_tags = {
    Project     = "multi-tenant-saloon"
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  # Keys are stable identifiers used to reference each bucket throughout this stack.
  frontend_buckets = {
    main-web        = "${var.name}-main-web"
    public-web      = "${var.name}-public-web"
    super-admin-web = "${var.name}-super-admin-web"
  }
}

# ── Default VPC (no custom VPC needed for dev) ────────────────────────────────
# ECS tasks get assign_public_ip=true so they reach ghcr.io without a NAT gateway.
# RDS stays non-publicly-accessible; its SG only allows 5432 from the ECS SG.

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ALB: allow HTTP/HTTPS from internet
resource "aws_security_group" "alb" {
  name        = "${var.name}-${var.environment}-alb-sg"
  description = "ALB — allow HTTP/HTTPS from internet"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${var.name}-${var.environment}-alb-sg" })
}

# ECS tasks: inbound from ALB only; outbound unrestricted (ghcr.io pull + RDS)
resource "aws_security_group" "ecs" {
  name        = "${var.name}-${var.environment}-ecs-sg"
  description = "ECS tasks — inbound 8080 from ALB, outbound unrestricted"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${var.name}-${var.environment}-ecs-sg" })
}

# RDS: inbound PostgreSQL from ECS tasks only; publicly_accessible=false enforced in rds module
resource "aws_security_group" "rds" {
  name        = "${var.name}-${var.environment}-rds-sg"
  description = "RDS — allow PostgreSQL from ECS tasks only"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${var.name}-${var.environment}-rds-sg" })
}

# ── RDS ───────────────────────────────────────────────────────────────────────

module "rds" {
  source = "../../modules/rds"

  name               = "${var.name}-${var.environment}"
  dev_mode           = true
  db_name            = var.db_name
  db_username        = var.db_username
  subnet_ids         = data.aws_subnets.default.ids
  security_group_id  = aws_security_group.rds.id
  secret_path_prefix = "multi-tenant-saloon/${var.environment}"
  tags               = local.common_tags
}

# ── GHCR credentials ─────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "ghcr_credentials" {
  name                    = "/multi-tenant-saloon/${var.environment}/ghcr-credentials"
  recovery_window_in_days = 0
  tags                    = local.common_tags
}

resource "aws_secretsmanager_secret_version" "ghcr_credentials" {
  secret_id = aws_secretsmanager_secret.ghcr_credentials.id
  secret_string = jsonencode({
    username = var.ghcr_username
    password = var.ghcr_pat
  })
}

# ── ECS (Fargate Spot, public subnets, public IP — no NAT) ───────────────────

module "ecs" {
  source = "../../modules/ecs"

  name                        = "${var.name}-${var.environment}"
  aws_region                  = var.aws_region
  vpc_id                      = data.aws_vpc.default.id
  public_subnet_ids           = data.aws_subnets.default.ids
  private_subnet_ids          = data.aws_subnets.default.ids   # same subnets; tasks use public IP
  assign_public_ip            = true                           # replaces NAT gateway
  alb_security_group_id       = aws_security_group.alb.id
  ecs_security_group_id       = aws_security_group.ecs.id
  acm_certificate_arn         = var.api_acm_certificate_arn
  container_name              = "saloon-backend"
  container_image             = "ghcr.io/${var.ghcr_image}:latest"
  ghcr_credentials_secret_arn = aws_secretsmanager_secret.ghcr_credentials.arn
  spring_profile              = var.environment
  task_cpu                    = 512
  task_memory                 = 1024
  desired_count               = 1
  min_tasks                   = 1
  max_tasks                   = 3
  log_retention_days          = 14
  enable_deletion_protection  = false

  secrets_manager_arns = [
    module.rds.secret_arn_db_url,
    module.rds.secret_arn_db_username,
    module.rds.secret_arn_db_password,
  ]
  secret_arn_db_url      = module.rds.secret_arn_db_url
  secret_arn_db_username = module.rds.secret_arn_db_username
  secret_arn_db_password = module.rds.secret_arn_db_password

  tags = local.common_tags
}

# ── S3 Content Buckets (one module instance per bucket via for_each) ──────────

module "s3" {
  for_each = local.frontend_buckets
  source   = "../../modules/s3"

  name          = each.value
  force_destroy = true
  tags          = local.common_tags
}

# cf-logs has different config (log-delivery ACL, no OAC) so it lives here directly.
resource "aws_s3_bucket" "cf_logs" {
  bucket        = "${var.name}-cf-logs"
  force_destroy = true
  tags          = merge(local.common_tags, { Name = "${var.name}-cf-logs" })
}

resource "aws_s3_bucket_ownership_controls" "cf_logs" {
  bucket = aws_s3_bucket.cf_logs.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "cf_logs" {
  bucket     = aws_s3_bucket.cf_logs.id
  acl        = "log-delivery-write"
  depends_on = [aws_s3_bucket_ownership_controls.cf_logs]
}

# ── CloudFront ─────────────────────────────────────────────────────────────────
# OAC IDs from module.s3[*] create an implicit dependency on the S3 module,
# so no explicit depends_on is needed.

module "cloudfront" {
  source = "../../modules/cloudfront"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name                      = "${var.name}-${var.environment}"
  domain                    = var.domain
  main_web_bucket_domain    = module.s3["main-web"].bucket_regional_domain
  public_web_bucket_domain  = module.s3["public-web"].bucket_regional_domain
  super_admin_bucket_domain = module.s3["super-admin-web"].bucket_regional_domain
  cf_logs_bucket            = aws_s3_bucket.cf_logs.id
  oac_main_web_id           = module.s3["main-web"].oac_id
  oac_public_web_id         = module.s3["public-web"].oac_id
  oac_super_admin_id        = module.s3["super-admin-web"].oac_id
  tags                      = local.common_tags
}

# ── S3 Bucket Policies (OAC) ──────────────────────────────────────────────────
# Declared here (not inside the s3 module) so they can reference both
# module.s3[*] and module.cloudfront outputs without creating a cycle.
# Each bucket maps to a specific CloudFront distribution ARN.

locals {
  bucket_policy_map = {
    main-web        = module.cloudfront.main_distribution_arn
    public-web      = module.cloudfront.wildcard_distribution_arn
    super-admin-web = module.cloudfront.wildcard_distribution_arn
  }
}

data "aws_iam_policy_document" "s3_oac" {
  for_each = local.bucket_policy_map

  statement {
    sid    = "AllowCloudFrontOAC"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${module.s3[each.key].bucket_arn}/*"]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [each.value]
    }
  }
}

resource "aws_s3_bucket_policy" "s3_oac" {
  for_each = local.bucket_policy_map
  bucket   = module.s3[each.key].bucket_id
  policy   = data.aws_iam_policy_document.s3_oac[each.key].json
}

# ── Route 53 ─────────────────────────────────────────────────────────────────

module "route53" {
  source = "../../modules/route53"

  domain              = var.domain
  cf_main_domain      = module.cloudfront.main_distribution_domain
  cf_main_zone_id     = module.cloudfront.main_distribution_zone_id
  cf_wildcard_domain  = module.cloudfront.wildcard_distribution_domain
  cf_wildcard_zone_id = module.cloudfront.wildcard_distribution_zone_id
  alb_dns_name        = module.ecs.alb_dns_name
  alb_zone_id         = module.ecs.alb_zone_id
}
