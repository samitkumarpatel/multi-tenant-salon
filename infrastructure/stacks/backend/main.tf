locals {
  common_tags = {
    Project     = "multi-tenant-saloon"
    Environment = var.environment
    ManagedBy   = "terraform"
    Stack       = "backend"
  }
}

# ── Default VPC ────────────────────────────────────────────────────────────────
# ECS tasks use assign_public_ip=true — no NAT gateway needed.
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

# ── Security Groups ────────────────────────────────────────────────────────────

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
  dev_mode           = var.environment == "dev"
  db_name            = var.db_name
  db_username        = var.db_username
  subnet_ids         = data.aws_subnets.default.ids
  security_group_id  = aws_security_group.rds.id
  secret_path_prefix = "multi-tenant-saloon/${var.environment}"
  tags               = local.common_tags
}

# ── GHCR credentials ──────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "ghcr_credentials" {
  name                    = "/multi-tenant-saloon/${var.environment}/ghcr-credentials"
  recovery_window_in_days = var.environment == "dev" ? 0 : 30
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
  private_subnet_ids          = data.aws_subnets.default.ids
  assign_public_ip            = true
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
  enable_deletion_protection  = var.environment != "dev"

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

# ── Route 53 — api subdomain ──────────────────────────────────────────────────

data "aws_route53_zone" "this" {
  name         = var.domain
  private_zone = false
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = "api.${var.domain}"
  type    = "A"
  alias {
    name                   = module.ecs.alb_dns_name
    zone_id                = module.ecs.alb_zone_id
    evaluate_target_health = true
  }
}
