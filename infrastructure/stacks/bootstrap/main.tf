locals {
  common_tags = {
    Project     = "multi-tenant-saloon"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

module "dns_bootstrap" {
  source = "../../modules/dns-bootstrap"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  domain = var.domain
  tags   = local.common_tags
}
