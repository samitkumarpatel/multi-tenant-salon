locals {
  stack_name = "${var.name}-${var.environment}"

  common_tags = {
    Project     = "multi-tenant-salon"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ── Container Apps Environment ────────────────────────────────────────────────

module "environment" {
  source = "../../modules/container-apps-env"

  name                       = local.stack_name
  location                   = var.location
  resource_group_name        = var.resource_group_name
  enable_monitoring          = var.enable_monitoring
  log_analytics_workspace_id = var.log_analytics_workspace_id
  tags                       = local.common_tags
}

# ── Services ───────────────────────────────────────────────────────────────────

module "services" {
  source   = "../../modules/container-apps"
  for_each = var.services

  name                         = "${local.stack_name}-${each.key}"
  resource_group_name          = var.resource_group_name
  container_app_environment_id = module.environment.id
  registry_password            = var.registry_password
  container                    = each.value.container
  ingress                      = each.value.ingress
  replicas                     = each.value.replicas
  tags                         = local.common_tags
}
