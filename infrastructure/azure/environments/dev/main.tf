locals {
  environment          = "dev"
  domain               = "salonsaas.org"
  location             = "eastus"
  resource_group_name  = "multi-tenant-salon-${local.environment}"
}

# ── Single Resource Group ──────────────────────────────────────────────────────
# All Azure resources for this environment live here.

module "resource_group" {
  source = "../../modules/resource-group"

  name     = local.resource_group_name
  location = local.location

  tags = {
    Project     = "multi-tenant-salon"
    Environment = local.environment
    ManagedBy   = "terraform"
  }
}

# ── DNS Zone ───────────────────────────────────────────────────────────────────
# Run this first and update your registrar NS records before deploying the rest.

module "dns_bootstrapping" {
  source = "../../stacks/dns-bootstrapping"

  environment         = local.environment
  resource_group_name = module.resource_group.name
  location            = module.resource_group.location
  domain              = local.domain

  dns_records = {
    zoho_mx = {
      type   = "MX"
      name   = "@"
      values = ["10 mx.zoho.eu", "20 mx2.zoho.eu", "50 mx3.zoho.eu"]
    }
    spf = {
      type   = "TXT"
      name   = "@"
      values = [
        "v=spf1 include:spf.mailjet.com include:zohomail.eu ~all",
        "zoho-verification=zb86027192.zmverify.zoho.eu",
      ]
    }
    zoho_dkim = {
      type   = "TXT"
      name   = "zmail._domainkey"
      values = ["v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCW91cv/+AW+BouuQNOHlzvJGYSrBTLftd9D2shUP/79LOO0cDOwhSNCvN+/nrW09TYUIfbpLF4DAp9pOavHyS95NnxPnq6i1z1ghcdqcQy5KlGkBI3tCOEgqF2yKlN69jBCic6W7NVO70hWrTJ9LYI2CWpz3bAXwiiAEVGpnNRrQIDAQAB"]
    }
    mailjet_dkim = {
      type   = "TXT"
      name   = "mailjet._domainkey"
      values = ["v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3H50B8nSmiEZ1l/Rzdj/MIg0eol1S1d7NnD6gGrb3QOq0gmw8nt5kBjf/qWCK3QCufnkMFDhph5gf8G+IsLPI+v6yCqG0A7JtQVmsptnTzLwR7LxDv6SoLpWQ7WeblUVNu+38JMorWaWcSNWtSt7bhJ5k9nsLvWeoo+wx+kchZ7n8vGfoQxo2NyV+pRCakqX6SX5KHnic5sw5RPKUM8PZeDYuoobShWkeSSmZIb98+Poe4wj0gjX6+IX96pj8d7HUJ8qjkvXVaEZGV6xIgV0JoJ73OM0MQedApCFCdO1dlDJmFUpWKuddwPaI6z/x/Ta2B46otZ4EEcvho9QLPyxEwIDAQAB"]
    }
    mailjet_verify = {
      type   = "TXT"
      name   = "mailjet._8bc30511"
      values = ["8bc30511bed47420ccc221dca77c12b8"]
    }
    # CDN CNAME records — added after first frontend apply exposes CDN hostnames
    # onboarding = { type = "CNAME", name = "@",           values = ["<onboarding-cdn-hostname>"] }
    # admin      = { type = "CNAME", name = "admin",       values = ["<admin-cdn-hostname>"] }
    # staff      = { type = "CNAME", name = "staff",       values = ["<staff-cdn-hostname>"] }
    # booking    = { type = "CNAME", name = "book",        values = ["<booking-cdn-hostname>"] }
  }
}

# ── Frontend ───────────────────────────────────────────────────────────────────

module "frontend" {
  source = "../../stacks/frontend"

  name                = "my-salon"
  environment         = local.environment
  resource_group_name = module.resource_group.name
  location            = module.resource_group.location

  # Storage account names: globally unique, 3-24 chars, lowercase alphanumeric only
  storage_accounts = {
    onboarding-web  = { storage_account_name = "mysalondevonboarding" }
    admin-web       = { storage_account_name = "mysalondevadmin" }
    public-web      = { storage_account_name = "mysalondevpublic" }
    super-admin-web = { storage_account_name = "mysalondevsuperadmin" }
    booking-web     = { storage_account_name = "mysalondevbooking" }
    staff-web = {
      storage_account_name = "mysalondevstaff"
      cors_rules = [
        {
          allowed_methods = ["GET", "PUT", "POST", "HEAD"]
          allowed_origins = ["https://staff.${local.domain}", "https://admin.${local.domain}"]
          allowed_headers = ["*"]
          exposed_headers = ["ETag"]
          max_age_seconds = 3000
        }
      ]
    }
  }

  cdn_custom_hostnames = {
    onboarding-web  = local.domain
    admin-web       = "admin.${local.domain}"
    public-web      = "app.${local.domain}"
    super-admin-web = "super-admin.${local.domain}"
    booking-web     = "book.${local.domain}"
    staff-web       = "staff.${local.domain}"
  }
}

# ── Backend ────────────────────────────────────────────────────────────────────

module "backend" {
  source = "../../stacks/backend"

  name                = "my-salon"
  environment         = local.environment
  resource_group_name = module.resource_group.name
  location            = module.resource_group.location

  # Key Vault name: globally unique, 3-24 chars, alphanumeric + hyphens
  key_vault_name = "my-salon-dev-kv"

  ghcr_token         = var.ghcr_token
  mailjet_api_key    = var.mailjet_api_key
  mailjet_api_secret = var.mailjet_api_secret
  postgres_password  = var.postgres_password

  system_node_count    = 2
  spot_min_count       = 1
  spot_max_count       = 3
  postgres_disk_size_gb = 32
}
