locals {
  frontend_name = "${var.name}-${var.environment}-fe"

  common_tags = {
    Project     = "multi-tenant-salon"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ── Storage Accounts (one per SPA) ────────────────────────────────────────────

module "storage" {
  source = "../../modules/storage"

  resource_group_name = var.resource_group_name
  location            = var.location
  accounts            = var.storage_accounts
  tags                = local.common_tags
}

# ── Azure CDN ─────────────────────────────────────────────────────────────────
# Endpoints map 1:1 with storage accounts. custom_hostname drives
# CDN-managed TLS — the CDN profile provisions a free certificate once
# the CNAME record in dns-bootstrapping points to the endpoint host.

module "cdn" {
  source = "../../modules/cdn"

  name                = local.frontend_name
  resource_group_name = var.resource_group_name

  dns_zone_id = var.dns_zone_id

  endpoints = {
    for k, v in var.storage_accounts : k => {
      origin_host     = try(module.storage.accounts[k].primary_web_host, "${v.storage_account_name}.z1.web.core.windows.net")
      custom_hostname = lookup(var.cdn_custom_hostnames, k, null)
    }
  }

  tags = local.common_tags
}
