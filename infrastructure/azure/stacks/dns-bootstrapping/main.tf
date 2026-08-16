locals {
  common_tags = {
    Project     = "multi-tenant-salon"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ── Azure DNS Zone ─────────────────────────────────────────────────────────────
# After apply, update your registrar's NS records with the name servers output.

module "dns_zone" {
  source = "../../modules/dns-zone"

  domain              = var.domain
  resource_group_name = var.resource_group_name
  records             = var.dns_records
  tags                = local.common_tags
}
