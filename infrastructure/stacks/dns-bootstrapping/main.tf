locals {
  common_tags = {
    Project     = "multi-tenant-saloon"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Phase 1 — apply this target first, then update NS records at your registrar:
#   terraform apply -target=module.dns_bootstrapping.module.dns_zone
module "dns_zone" {
  source = "../../modules/dns-zone"

  domain = var.domain
  tags   = local.common_tags
}

# Phase 2 — run after registrar NS records are updated and propagated:
#   terraform apply
module "dns_cert" {
  source = "../../modules/dns-cert"

  providers = {
    aws.us_east_1 = aws.us_east_1
  }

  domain  = var.domain
  zone_id = module.dns_zone.zone_id
  tags    = local.common_tags
}
