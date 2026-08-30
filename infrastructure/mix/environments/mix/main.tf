locals {
  environment = "mix"
  domain      = "salonsaas.org"

  common_tags = {
    Project     = "multi-tenant-salon"
    Environment = local.environment
    ManagedBy   = "terraform"
  }

  # Public hostname for each frontend app. onboarding is the apex; every other
  # app is a plain sub-domain. azure/ no longer owns any of these names — the
  # Cloudflare zone created below is authoritative for the whole domain.
  frontend_hostnames = {
    onboarding-web  = local.domain # salonsaas.org  (apex, CNAME-flattened)
    admin-web       = "admin.${local.domain}"
    public-web      = "public.${local.domain}"
    super-admin-web = "super-admin.${local.domain}"
    booking-web     = "book.${local.domain}"
    staff-web       = "staff.${local.domain}"
  }

  # salon-public-website additionally serves every tenant sub-domain.
  wildcard_host = "*.${local.domain}"

  api_host  = "api.${local.domain}"
  auth_host = "auth.${local.domain}"

  # auth → api is an in-environment, backend-to-backend call. Both apps live in
  # the same Container Apps environment, so auth reaches api by app name over the
  # internal network — no public DNS, no TLS cert, no bind_custom_domains
  # dependency. App name = "${var.name}-${local.environment}-<service key>".
  api_internal_url = "http://salon-saas-mix-api"

  # CORS allow-list for the api: every frontend origin + the tenant wildcard.
  cors_allowed_origins = join(",", concat(
    [for h in values(local.frontend_hostnames) : "https://${h}"],
    ["https://${local.wildcard_host}"],
  ))
}

# ── Resource Group — created and owned by mix ─────────────────────────────────
# A NEW, dedicated RG (multi-tenant-salon-mix). Holds every Azure resource in
# this environment: the Container Apps environment, the api + auth Container
# Apps, the PostgreSQL Flexible Server, and Key Vault. The old
# multi-tenant-salon-dev RG (and everything in it) is destroyed via
# azure/environments/dev — see infrastructure/mix/README.md, "Cut-over runbook".

resource "azurerm_resource_group" "shared" {
  name     = var.azure_resource_group
  location = var.azure_location
  tags     = local.common_tags
}

# ── 1. DNS zone — Cloudflare (authoritative) ────────────────────────────────
# Replaces the retired Azure DNS zone. After the first apply, switch the NS
# records at the domain registrar to the `name_servers` output, then wait for
# the zone status to go "active".

module "dns" {
  source = "../../stacks/dns-zone"

  account_id = var.cloudflare_account_id
  zone_name  = local.domain
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
      project = "salonsaas-${trimsuffix(k, "-web")}"
      # NOTE: Cloudflare Pages custom domains do not accept a literal wildcard
      # ("*.salonsaas.org" -> 400 "Domain is invalid"). Per-tenant sites on
      # salon-public-website need Cloudflare for SaaS (custom hostnames) or a
      # Worker — a follow-up. For now each app gets only its own hostname.
      custom_domains = [host]
    }
  }
}

# ── 2b. Backend — Azure Container Apps (api + auth) + Key Vault ──────────────

module "backend" {
  source = "../../stacks/backend"

  name                = "salon-saas"
  environment         = local.environment
  resource_group_name = azurerm_resource_group.shared.name
  location            = azurerm_resource_group.shared.location

  key_vault_name             = "salon-saas-mix-kv"
  key_vault_admin_object_ids = var.key_vault_admin_object_ids
  # GHCR PAT (read:packages) attached to both Container Apps as a registry
  # credential. The images are currently public so anonymous pull also works,
  # but this keeps pulls working if a package goes private. NOTE: if this PAT
  # expires, Container App pulls fail with DENIED (no anonymous fallback once a
  # credential is configured) — rotate it and re-apply.
  registry_password = var.ghcr_token
  domain            = local.domain

  bind_custom_domains = var.bind_custom_domains

  # Cheap dev/test PostgreSQL — Flexible Server, Burstable B1ms (1 vCore / 2 GiB),
  # 32 GiB storage. Its SPRING_DATASOURCE_* vars are merged into the `api`
  # container; the generated password lands in Key Vault as spring-datasource-*.
  # allow_azure_services (default) = the Container Apps deployment can reach it;
  # var.postgres_client_ips opens it to specific public IPs on demand.
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
        # Aligned with helm/api/values.yaml `env:` — same keys, mix values.
        # SPRING_DATASOURCE_URL / _USERNAME are set by the backend stack from
        # module.postgres; SPRING_DATASOURCE_PASSWORD is a Container App secret.
        env = {
          SPRING_SQL_INIT_MODE                                      = "never"
          SPRING_MODULITH_EVENTS_JDBC_SCHEMA_INITIALIZATION_ENABLED = "false"
          SPRING_FLYWAY_ENABLED                                     = "true"
          STORAGE_TYPE                                              = "LOCAL"
          BPL_JVM_THREAD_COUNT                                      = "100"
          SPRING_CLOUD_AWS_S3_ENABLED                               = "false"
          AWS_DEFAULT_REGION                                        = "eu-north-1"
          MEDIA_STAFF_BUCKET_NAME                                   = "" # only needed when STORAGE_TYPE=S3
          MEDIA_STAFF_CDN_BASE_URL                                  = "https://${local.frontend_hostnames["staff-web"]}"
          MEDIA_LOCAL_BASE_URL                                      = "https://${local.api_host}"
          MEDIA_LOCAL_STORAGE_PATH                                  = "/tmp/salon-photos" # ephemeral — lost on new revision / scale-to-zero
          CORS_ALLOWED_ORIGIN_PATTERNS                              = local.cors_allowed_origins

          # OIDC: issuer stays the PUBLIC url — it's the value the JWT `iss` claim
          # is validated against, and auth stamps that (see auth's
          # SPRING_SECURITY_OAUTH2_AUTHORIZATIONSERVER_ISSUER). Only the JWKS key
          # fetch is pulled onto the internal network (Spring uses jwk-set-uri for
          # keys + issuer-uri for `iss` validation, no discovery round-trip).
          OAUTH2_ISSUER_URI                                     = "https://${local.auth_host}"
          SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_JWK_SET_URI = "http://salon-saas-mix-auth/oauth2/jwks"
        }
      }
      # Container App secrets — replaces the chart's mailjet-secret + anthropic-secret
      # envFrom. SPRING_DATASOURCE_PASSWORD is added by the backend stack.
      secret_env = {
        MAILJET_API_KEY    = var.mailjet_api_key
        MAILJET_API_SECRET = var.mailjet_api_secret
        ANTHROPIC_API_KEY  = var.anthropic_api_key
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
        # Aligned with ../multi-tenant-salon-authz/helm/auth/values.yaml `env:`.
        # IDENTITY_SERVICE_URL is the in-environment api URL — auth reaches api by
        # Container App name over the private network (no public hop, no TLS).
        env = {
          IDENTITY_SERVICE_URL        = local.api_internal_url
          CORS_ALLOWED_ORIGIN_PATTERN = "*"
          # Pin the OIDC issuer so minted tokens always carry
          # `iss: https://auth.salonsaas.org` regardless of whether the request
          # arrived on the public host or the internal one. api validates against
          # exactly this string.
          SPRING_SECURITY_OAUTH2_AUTHORIZATIONSERVER_ISSUER = "https://${local.auth_host}"
        }
      }
      # auth is stateless (no datasource) — it only needs the Mailjet pair, same
      # as the chart's shared mailjet-secret envFrom.
      secret_env = {
        MAILJET_API_KEY    = var.mailjet_api_key
        MAILJET_API_SECRET = var.mailjet_api_secret
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

# ── 3. Zone records ────────────────────────────────────────────────────────────
# Everything that lives in salonsaas.org. Frontend hostnames are proxied
# (orange-cloud) CNAMEs at <project>.pages.dev — the apex one is CNAME-flattened
# by Cloudflare. Backend hostnames are DNS-only (grey-cloud) CNAMEs straight at
# the Azure Container App FQDN so Azure can bind + serve its managed TLS cert;
# each needs an asuid.<sub> TXT for that validation. MX / SPF / DKIM are carried
# over verbatim from the old Azure zone (azure/stacks/dns-bootstrapping) so mail
# keeps working through the NS switch.

module "dns_record_updatation" {
  source = "../../stacks/dns-update"

  zone_id = module.dns.zone_id

  dns_records = {
    # ── Frontend — Cloudflare Pages (proxied) ──
    fe_apex   = { type = "CNAME", name = local.domain, content = module.frontend.pages_hostnames["onboarding-web"], proxied = true }
    fe_admin  = { type = "CNAME", name = local.frontend_hostnames["admin-web"], content = module.frontend.pages_hostnames["admin-web"], proxied = true }
    fe_public = { type = "CNAME", name = local.frontend_hostnames["public-web"], content = module.frontend.pages_hostnames["public-web"], proxied = true }
    # fe_wildcard (*.salonsaas.org) omitted — Cloudflare Pages can't take a
    # wildcard custom domain; add via Cloudflare for SaaS as a follow-up.
    fe_super_admin = { type = "CNAME", name = local.frontend_hostnames["super-admin-web"], content = module.frontend.pages_hostnames["super-admin-web"], proxied = true }
    fe_booking     = { type = "CNAME", name = local.frontend_hostnames["booking-web"], content = module.frontend.pages_hostnames["booking-web"], proxied = true }
    fe_staff       = { type = "CNAME", name = local.frontend_hostnames["staff-web"], content = module.frontend.pages_hostnames["staff-web"], proxied = true }

    # ── Backend — Azure Container Apps (DNS-only) ──
    be_api        = { type = "CNAME", name = local.api_host, content = module.backend.fqdns["api"], proxied = false }
    be_auth       = { type = "CNAME", name = local.auth_host, content = module.backend.fqdns["auth"], proxied = false }
    be_api_asuid  = { type = "TXT", name = "asuid.${local.api_host}", content = module.backend.custom_domain_verification_id }
    be_auth_asuid = { type = "TXT", name = "asuid.${local.auth_host}", content = module.backend.custom_domain_verification_id }

    # ── Email — Zoho MX + SPF, Zoho & Mailjet DKIM (carried over verbatim) ──
    mx_zoho_1 = { type = "MX", name = local.domain, content = "mx.zoho.eu", priority = 10 }
    mx_zoho_2 = { type = "MX", name = local.domain, content = "mx2.zoho.eu", priority = 20 }
    mx_zoho_3 = { type = "MX", name = local.domain, content = "mx3.zoho.eu", priority = 50 }

    spf           = { type = "TXT", name = local.domain, content = "v=spf1 include:spf.mailjet.com include:zohomail.eu ~all" }
    zoho_verify_1 = { type = "TXT", name = local.domain, content = "zoho-verification=zb86027192.zmverify.zoho.eu" }
    zoho_verify_2 = { type = "TXT", name = local.domain, content = "zoho-verification=zb49352062.zmverify.zoho.eu" }

    zoho_dkim      = { type = "TXT", name = "zmail._domainkey.${local.domain}", content = "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDfUTuWe6hESQXEIDuDRv10hluIbyiauYvAHfeS40Gd7/HXru9XQGhMqOGvCb4Phsd41y4eqcwMpWefyV7EzC4Sf385U5IH8mBkFS0960tZGihTJjranMFUCEElsV0ROD08L0R9IJ1FhPWENMPshPn+49HXjOn3rUKuFEDaNYa/BQIDAQAB" }
    mailjet_dkim   = { type = "TXT", name = "mailjet._domainkey.${local.domain}", content = "k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAk0ZlEpvpwmCVOqwhorC9E91b7T7OP7w7dyCN+8XA+6AIXVgDS8qRAqGN319A1vgCV7nL5O1LyorI3Zii1SIwrenYUM99P3PVoVdDBnHqifrx65kEAuIppPc1K5m5w7nr4FHMCFkjmgUtI5gW0HPrL7fKF36/38/GuhgVnjUZEJHYonlacXHN3MnyDKLd063sZGkiNEYKPwdAa9Cf+nvJNj4HUI6CbSfRoY9oZdYx3wBJkVtSC+5oEag289xuxZuGJ0/MSrUfF2IIbXXewtDGMD2vfc4gWWivlSAiEm9BwzgUzVAsO9kdCJAKDQRkVW2ReKciPu8dw7+EJ3QU8n7rkQIDAQAB" }
    mailjet_verify = { type = "TXT", name = "mailjet._4ae89c73.${local.domain}", content = "4ae89c73572f378b6006daff9627062e" }
  }
}
