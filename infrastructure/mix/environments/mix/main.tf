locals {
  environment = "mix"
  domain      = "salonsaas.org"

  common_tags = {
    Project     = "multi-tenant-salon"
    Environment = local.environment
    ManagedBy   = "terraform"
  }

  # Sub-domain for each frontend app and backend service. "-m" suffix wherever
  # the azure/dev environment already owns the plain name in this zone.
  frontend_hostnames = {
    onboarding-web  = "onboarding.${local.domain}"
    admin-web       = "admin-m.${local.domain}"
    public-web      = "public-m.${local.domain}"
    super-admin-web = "super-admin-m.${local.domain}"
    booking-web     = "book-m.${local.domain}"
    staff-web       = "staff-m.${local.domain}"
  }

  api_host  = "api-m.${local.domain}"
  auth_host = "auth-m.${local.domain}"

  # auth → api is an in-environment, backend-to-backend call. Both apps live in
  # the same Container Apps environment, so auth reaches api by app name over the
  # internal network — no public DNS, no TLS cert, no bind_custom_domains
  # dependency. App name = "${var.name}-${local.environment}-<service key>".
  api_internal_url = "http://salon-saas-mix-api"
}

# ── Resource Group — SHARED with the azure environment ──────────────────────
# All Azure resources for both `azure/environments/dev` and `mix` live in one
# resource group. `azure/dev` creates and owns it; `mix` only looks it up, so
# when `azure/dev` is torn down after the migration, mix's resources are already
# in the right place and nothing has to move.

data "azurerm_resource_group" "shared" {
  name = var.azure_resource_group
}

# ── 1. DNS zone — SHARED, read-only ─────────────────────────────────────────
# salonsaas.org is created and delegated by the live `azure` environment
# (azure/environments/dev). `mix` only looks it up and, in step 3, adds its own
# `*-m` sub-domain records. MX / SPF / DKIM and every existing record stay under
# azure/dev's ownership — `mix` never touches them.

module "dns" {
  source = "../../stacks/dns-zone"

  zone_name           = local.domain
  resource_group_name = data.azurerm_resource_group.shared.name
}

# ── 2a. Frontend — Cloudflare Pages (one direct-upload project per app) ──────

module "frontend" {
  source = "../../stacks/frontend"

  environment = local.environment
  domain      = local.domain
  account_id  = var.cloudflare_account_id

  apps = {
    for k, host in local.frontend_hostnames : k => {
      # e.g. "public-web" -> "salonsaas-public", "super-admin-web" -> "salonsaas-super-admin"
      project       = "salonsaas-${trimsuffix(k, "-web")}"
      custom_domain = host
    }
  }
}

# ── 2b. Backend — Azure Container Apps (api + auth) + Key Vault ──────────────

module "backend" {
  source = "../../stacks/backend"

  name                = "salon-saas"
  environment         = local.environment
  resource_group_name = data.azurerm_resource_group.shared.name
  location            = data.azurerm_resource_group.shared.location

  key_vault_name             = "salon-saas-mix-kv"
  key_vault_admin_object_ids = var.key_vault_admin_object_ids
  registry_password          = var.ghcr_token
  domain                     = local.domain

  bind_custom_domains = var.bind_custom_domains

  # Cheap dev/test PostgreSQL — Flexible Server, Burstable B1ms (1 vCore / 2 GiB),
  # 32 GiB storage. Its SPRING_DATASOURCE_* vars are merged into the `api`
  # container; the generated password lands in Key Vault as spring-datasource-*.
  # allow_azure_services (default) = the Container Apps + AKS deployments can
  # reach it; var.postgres_client_ips opens it to specific public IPs on demand.
  database = {
    service_key   = "api"
    server_name   = "salon-saas-mix-psql"
    database_name = "salon"

    firewall_rules = {
      for name, ip in var.postgres_client_ips : name => {
        start_ip_address = ip
        end_ip_address   = ip
      }
    }
  }

  services = {
    api = {
      custom_domain = local.api_host
      container = {
        name   = "api"
        image  = "ghcr.io/samitkumarpatel/multi-tenant-salon:latest"
        cpu    = 0.5
        memory = "1Gi"
        env = {
          "spring.sql.init.mode"                                      = "never"
          "spring.modulith.events.jdbc.schema-initialization.enabled" = "false"
          "spring.flyway.enabled"                                     = "true"
          CORS_ALLOWED_ORIGIN_PATTERNS                                = join(",", [for h in values(local.frontend_hostnames) : "https://${h}"])
        }
      }
      ingress = {
        external_enabled = true
        target_port      = 8080
        transport        = "auto"
      }
      replicas = { min = 0, max = 2 }
    }

    auth = {
      custom_domain = local.auth_host
      container = {
        name   = "auth"
        image  = "ghcr.io/samitkumarpatel/multi-tenant-salon-authz:latest"
        cpu    = 0.5
        memory = "1Gi"
        env = {
          IDENTITY_SERVICE_URL = local.api_internal_url
        }
      }
      ingress = {
        external_enabled = true
        target_port      = 9000
        transport        = "auto"
      }
      replicas = { min = 0, max = 1 }
    }
  }
}

# ── 3. Update the zone with records that depend on module outputs ────────────
# CNAMEs pointing each sub-domain at its Pages host / Container App FQDN, plus
# the asuid TXT records the Container Apps managed certificates validate against.

module "dns_record_updatation" {
  source = "../../stacks/dns-update"

  zone_name           = module.dns.zone_name
  resource_group_name = module.dns.resource_group_name
  dns_zone_id         = module.dns.zone_id

  dns_records = {
    fe_onboarding  = { type = "CNAME", name = "onboarding", values = [module.frontend.pages_hostnames["onboarding-web"]] }
    fe_admin       = { type = "CNAME", name = "admin-m", values = [module.frontend.pages_hostnames["admin-web"]] }
    fe_public      = { type = "CNAME", name = "public-m", values = [module.frontend.pages_hostnames["public-web"]] }
    fe_super_admin = { type = "CNAME", name = "super-admin-m", values = [module.frontend.pages_hostnames["super-admin-web"]] }
    fe_booking     = { type = "CNAME", name = "book-m", values = [module.frontend.pages_hostnames["booking-web"]] }
    fe_staff       = { type = "CNAME", name = "staff-m", values = [module.frontend.pages_hostnames["staff-web"]] }

    be_api  = { type = "CNAME", name = "api-m", values = [module.backend.fqdns["api"]] }
    be_auth = { type = "CNAME", name = "auth-m", values = [module.backend.fqdns["auth"]] }

    be_api_asuid  = { type = "TXT", name = "asuid.api-m", values = [module.backend.custom_domain_verification_id] }
    be_auth_asuid = { type = "TXT", name = "asuid.auth-m", values = [module.backend.custom_domain_verification_id] }
  }
}
