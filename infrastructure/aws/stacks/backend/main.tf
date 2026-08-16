locals {
  common_tags = {
    Project     = "multi-tenant-salon"
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  backend_name = "${var.name}-${var.environment}"

  # Merge RDS credentials, Mailjet secrets, and (for ghcr.io images) the registry
  # pull secret into every service. The environment layer never needs to know the
  # internal ARNs.
  services_with_db = {
    for k, svc in var.services : k => merge(svc, {
      ghcr_secret_arn = startswith(svc.image, "ghcr.io") ? aws_secretsmanager_secret.ghcr.arn : svc.ghcr_secret_arn
      secret_arns = merge(svc.secret_arns, {
        SPRING_DATASOURCE_URL      = module.rds.secret_arn_db_url
        SPRING_DATASOURCE_USERNAME = module.rds.secret_arn_db_username
        SPRING_DATASOURCE_PASSWORD = module.rds.secret_arn_db_password
        MAILJET_API_KEY            = aws_secretsmanager_secret.mailjet_api_key.arn
        MAILJET_API_SECRET         = aws_secretsmanager_secret.mailjet_api_secret.arn
      })
    })
  }
}

# ── Default VPC ───────────────────────────────────────────────────────────────

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# ── Security Groups ───────────────────────────────────────────────────────────
# Traffic path: internet → alb → ecs → rds

resource "aws_security_group" "alb" {
  name        = "${local.backend_name}-alb"
  description = "Public ALB - accepts HTTP and HTTPS from the internet"
  vpc_id      = data.aws_vpc.default.id
  tags        = merge(local.common_tags, { Name = "${local.backend_name}-alb" })
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_all" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "ecs" {
  name        = "${local.backend_name}-ecs"
  description = "ECS tasks - accepts traffic from internal ALB"
  vpc_id      = data.aws_vpc.default.id
  tags        = merge(local.common_tags, { Name = "${local.backend_name}-ecs" })
}

resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id            = aws_security_group.ecs.id
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "-1"
}

resource "aws_vpc_security_group_egress_rule" "ecs_all" {
  security_group_id = aws_security_group.ecs.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "rds" {
  name        = "${local.backend_name}-rds"
  description = "RDS PostgreSQL - accepts connections from ECS tasks only"
  vpc_id      = data.aws_vpc.default.id
  tags        = merge(local.common_tags, { Name = "${local.backend_name}-rds" })
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs" {
  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = aws_security_group.ecs.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

# ── RDS (PostgreSQL 17) ───────────────────────────────────────────────────────

module "rds" {
  source = "../../modules/rds"

  name               = local.backend_name
  dev_mode           = var.environment == "dev"
  subnet_ids         = data.aws_subnets.default.ids
  security_group_id  = aws_security_group.rds.id
  secret_path_prefix = "${var.name}/${var.environment}"
  tags               = local.common_tags
}

# ── GitHub Container Registry pull secret ────────────────────────────────────

resource "aws_secretsmanager_secret" "ghcr" {
  name                    = "/${var.name}/${var.environment}/ghcr-token"
  description             = "GitHub Container Registry pull credentials for ECS task execution"
  recovery_window_in_days = var.environment == "dev" ? 0 : 7
  tags                    = local.common_tags
}

resource "aws_secretsmanager_secret_version" "ghcr" {
  secret_id     = aws_secretsmanager_secret.ghcr.id
  secret_string = var.ghcr_token
}

# ── Mailjet credentials ───────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "mailjet_api_key" {
  name                    = "/${var.name}/${var.environment}/mailjet-api-key"
  description             = "Mailjet API key injected into ECS tasks as MAILJET_API_KEY"
  recovery_window_in_days = var.environment == "dev" ? 0 : 7
  tags                    = local.common_tags
}

resource "aws_secretsmanager_secret_version" "mailjet_api_key" {
  secret_id     = aws_secretsmanager_secret.mailjet_api_key.id
  secret_string = var.mailjet_api_key
}

resource "aws_secretsmanager_secret" "mailjet_api_secret" {
  name                    = "/${var.name}/${var.environment}/mailjet-api-secret"
  description             = "Mailjet API secret injected into ECS tasks as MAILJET_API_SECRET"
  recovery_window_in_days = var.environment == "dev" ? 0 : 7
  tags                    = local.common_tags
}

resource "aws_secretsmanager_secret_version" "mailjet_api_secret" {
  secret_id     = aws_secretsmanager_secret.mailjet_api_secret.id
  secret_string = var.mailjet_api_secret
}

# ── ECS (Fargate) ─────────────────────────────────────────────────────────────

module "ecs" {
  source = "../../modules/ecs"

  name       = local.backend_name
  aws_region = var.aws_region

  internal              = false
  vpc_id                = data.aws_vpc.default.id
  public_subnet_ids     = data.aws_subnets.default.ids
  private_subnet_ids    = data.aws_subnets.default.ids
  alb_security_group_id = aws_security_group.alb.id
  ecs_security_group_id = aws_security_group.ecs.id
  acm_certificate_arn   = var.regional_certificate_arn

  # Default VPC subnets are public; tasks get a public IP to reach ghcr.io
  # without a NAT gateway. RDS access is gated by the rds security group.
  assign_public_ip = true

  enable_deletion_protection = var.environment != "dev"

  services = local.services_with_db
  ingress  = var.ingress
  tags     = local.common_tags
}

# ── Route 53 — all ingress hostnames → ALB ────────────────────────────────────

resource "aws_route53_record" "ingress" {
  for_each = var.ingress

  zone_id = var.zone_id
  name    = each.key
  type    = "A"

  alias {
    name                   = module.ecs.alb_dns_name
    zone_id                = module.ecs.alb_zone_id
    evaluate_target_health = true
  }
}
