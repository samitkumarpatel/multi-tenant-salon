locals {
  environment         = "dev"
  domain              = "salonsaas.org"
  location            = "westeurope"
  resource_group_name = "multi-tenant-salon-${local.environment}"

  # Custom hostname for each frontend app
  cdn_custom_hostnames = {
    onboarding-web  = local.domain
    admin-web       = "admin.${local.domain}"
    super-admin-web = "super-admin.${local.domain}"
    booking-web     = "book.${local.domain}"
    staff-web       = "staff.${local.domain}"
  }
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
      type = "TXT"
      name = "@"
      values = [
        "v=spf1 include:spf.mailjet.com include:zohomail.eu ~all",
        "zoho-verification=zb86027192.zmverify.zoho.eu",
        "zoho-verification=zb49352062.zmverify.zoho.eu",
      ]
    }
    zoho_dkim = {
      type   = "TXT"
      name   = "zmail._domainkey"
      values = ["v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDfUTuWe6hESQXEIDuDRv10hluIbyiauYvAHfeS40Gd7/HXru9XQGhMqOGvCb4Phsd41y4eqcwMpWefyV7EzC4Sf385U5IH8mBkFS0960tZGihTJjranMFUCEElsV0ROD08L0R9IJ1FhPWENMPshPn+49HXjOn3rUKuFEDaNYa/BQIDAQAB"]
    }
    mailjet_dkim = {
      type   = "TXT"
      name   = "mailjet._domainkey"
      values = ["k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAk0ZlEpvpwmCVOqwhorC9E91b7T7OP7w7dyCN+8XA+6AIXVgDS8qRAqGN319A1vgCV7nL5O1LyorI3Zii1SIwrenYUM99P3PVoVdDBnHqifrx65kEAuIppPc1K5m5w7nr4FHMCFkjmgUtI5gW0HPrL7fKF36/38/GuhgVnjUZEJHYonlacXHN3MnyDKLd063sZGkiNEYKPwdAa9Cf+nvJNj4HUI6CbSfRoY9oZdYx3wBJkVtSC+5oEag289xuxZuGJ0/MSrUfF2IIbXXewtDGMD2vfc4gWWivlSAiEm9BwzgUzVAsO9kdCJAKDQRkVW2ReKciPu8dw7+EJ3QU8n7rkQIDAQAB"]
    }
    mailjet_verify2 = {
      type   = "TXT"
      name   = "mailjet._4ae89c73"
      values = ["4ae89c73572f378b6006daff9627062e"]
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

  name                = "salon-saas"
  environment         = local.environment
  resource_group_name = module.resource_group.name
  location            = module.resource_group.location

  # Storage account names: globally unique, 3-24 chars, lowercase alphanumeric only
  storage_accounts = {
    onboarding-web  = { storage_account_name = "salonsaasdevonboarding" }
    admin-web       = { storage_account_name = "salonsaasdevadmin" }
    public-web      = { storage_account_name = "salonsaasdevpublic" }
    super-admin-web = { storage_account_name = "salonsaasdevsuperadmin" }
    booking-web     = { storage_account_name = "salonsaasdevbooking" }
    staff-web = {
      storage_account_name = "salonsaasdevstaff"
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

  domain               = local.domain
  cdn_custom_hostnames = local.cdn_custom_hostnames
  cdn_extra_hostnames = {
    public-web = ["*.${local.domain}"]
  }
  dns_zone_id = module.dns_bootstrapping.zone_id
}

# ── Backend ────────────────────────────────────────────────────────────────────

module "backend" {
  source = "../../stacks/backend"

  name                = "salon-saas"
  environment         = local.environment
  resource_group_name = module.resource_group.name
  resource_group_id   = module.resource_group.id
  location            = module.resource_group.location

  # Key Vault name: globally unique, 3-24 chars, alphanumeric + hyphens
  key_vault_name = "salon-saas-dev-kv"

  domain             = local.domain
  dns_zone_id        = module.dns_bootstrapping.zone_id
  ingress_subdomains = ["api", "auth"]

  system_node_count     = 1
  system_vm_size        = "Standard_B2s"
  spot_min_count        = 1
  spot_max_count        = 3
  postgres_disk_size_gb = 32
  postgres_disk_sku     = "Standard_LRS"
  enable_monitoring     = false
}

