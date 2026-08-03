locals {
  common_tags = {
    Project     = "multi-tenant-saloon"
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  backend_name = "${var.name}-${var.environment}"

  # Merge RDS credentials and (for ghcr.io images) the registry pull secret into
  # every service. The environment layer never needs to know the internal ARNs.
  services_with_db = {
    for k, svc in var.services : k => merge(svc, {
      ghcr_secret_arn = startswith(svc.image, "ghcr.io") ? aws_secretsmanager_secret.ghcr.arn : svc.ghcr_secret_arn
      secret_arns = merge(svc.secret_arns, {
        SPRING_DATASOURCE_URL      = module.rds.secret_arn_db_url
        SPRING_DATASOURCE_USERNAME = module.rds.secret_arn_db_username
        SPRING_DATASOURCE_PASSWORD = module.rds.secret_arn_db_password
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
# Traffic path: vpc_link → alb → ecs → rds

resource "aws_security_group" "vpc_link" {
  name        = "${local.backend_name}-vpc-link"
  description = "API Gateway VPC Link ENIs"
  vpc_id      = data.aws_vpc.default.id
  tags        = merge(local.common_tags, { Name = "${local.backend_name}-vpc-link" })
}

resource "aws_vpc_security_group_egress_rule" "vpc_link_all" {
  security_group_id = aws_security_group.vpc_link.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "alb" {
  name        = "${local.backend_name}-alb"
  description = "Internal ALB — accepts traffic from API Gateway VPC Link"
  vpc_id      = data.aws_vpc.default.id
  tags        = merge(local.common_tags, { Name = "${local.backend_name}-alb" })
}

resource "aws_vpc_security_group_ingress_rule" "alb_from_vpc_link" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = aws_security_group.vpc_link.id
  from_port                    = 80
  to_port                      = 80
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_all" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "ecs" {
  name        = "${local.backend_name}-ecs"
  description = "ECS tasks — accepts traffic from internal ALB"
  vpc_id      = data.aws_vpc.default.id
  tags        = merge(local.common_tags, { Name = "${local.backend_name}-ecs" })
}

resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id            = aws_security_group.ecs.id
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 8080
  to_port                      = 8080
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "ecs_all" {
  security_group_id = aws_security_group.ecs.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "rds" {
  name        = "${local.backend_name}-rds"
  description = "RDS PostgreSQL — accepts connections from ECS tasks only"
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
# Created empty by Terraform; populate once via CLI before first ECS deploy:
#   aws secretsmanager put-secret-value \
#     --secret-id <ghcr_secret_name output> \
#     --secret-string '{"username":"<github-user>","password":"<PAT with read:packages>"}'

resource "aws_secretsmanager_secret" "ghcr" {
  name                    = "/${var.name}/${var.environment}/ghcr-token"
  description             = "GitHub Container Registry pull credentials for ECS task execution"
  recovery_window_in_days = var.environment == "dev" ? 0 : 7
  tags                    = local.common_tags
}

# ── ECS (Fargate) ─────────────────────────────────────────────────────────────

module "ecs" {
  source = "../../modules/ecs"

  name       = local.backend_name
  aws_region = var.aws_region

  internal              = true
  vpc_id                = data.aws_vpc.default.id
  public_subnet_ids     = data.aws_subnets.default.ids
  private_subnet_ids    = data.aws_subnets.default.ids
  alb_security_group_id = aws_security_group.alb.id
  ecs_security_group_id = aws_security_group.ecs.id

  # Default VPC subnets are public; tasks get a public IP to reach ghcr.io
  # without a NAT gateway. RDS access is gated by the rds security group.
  assign_public_ip = true

  enable_deletion_protection = var.environment != "dev"

  services    = local.services_with_db
  http_routes = var.routes.http
  tags        = local.common_tags
}

# ── API Gateway v2 (HTTP + WebSocket) ─────────────────────────────────────────

module "api_gateway" {
  source = "../../modules/api-gateway"

  name               = local.backend_name
  subnet_ids         = data.aws_subnets.default.ids
  security_group_ids = [aws_security_group.vpc_link.id]
  alb_listener_arn   = module.ecs.alb_listener_arn
  domain             = var.domain
  certificate_arn    = var.regional_certificate_arn
  zone_id            = var.zone_id
  ws_routes          = var.routes.ws
  tags               = local.common_tags
}
