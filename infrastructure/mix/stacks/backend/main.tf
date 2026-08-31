locals {
  stack_name = "${var.name}-${var.environment}"

  common_tags = {
    Project     = "multi-tenant-salon"
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  # Services that declare a custom_domain — the asuid TXT / CNAME records are
  # always emitted for these (via the stack outputs); the cert + binding below
  # are only created once bind_custom_domains is true.
  service_domains = { for k, s in var.services : k => s.custom_domain if s.custom_domain != null }
  domains_to_bind = var.bind_custom_domains ? local.service_domains : {}

  # ── Database wiring ────────────────────────────────────────────────────────
  db_enabled     = var.database != null
  db_service_key = try(var.database.service_key, null)

  # Injected into the DB-backed service's container env once the server exists.
  # URL + username are plain env; the password is a Container App secret (below),
  # mirroring the chart's secretKeyRef on SPRING_DATASOURCE_PASSWORD.
  db_env = local.db_enabled ? {
    SPRING_DATASOURCE_URL      = module.postgres[0].jdbc_url
    SPRING_DATASOURCE_USERNAME = module.postgres[0].administrator_login
  } : {}

  db_secret_env = local.db_enabled ? {
    SPRING_DATASOURCE_PASSWORD = random_password.db[0].result
  } : {}

  # ── Media storage wiring ──────────────────────────────────────────────────
  media_enabled      = var.media_storage != null
  media_service_keys = local.media_enabled ? var.media_storage.service_keys : []

  media_env = local.media_enabled ? {
    STORAGE_TYPE               = "AZURE"
    AZURE_STORAGE_ACCOUNT_NAME = var.media_storage.storage_account_name
    MEDIA_STAFF_CONTAINER_NAME = var.media_storage.container_name
    MEDIA_STAFF_CDN_BASE_URL   = "https://${var.media_storage.storage_account_name}.blob.core.windows.net/${var.media_storage.container_name}"
  } : {}

  # Account key → Container App secret (also lands in Key Vault via app_secrets).
  media_secret_env = local.media_enabled ? {
    AZURE_STORAGE_ACCOUNT_KEY = module.media_storage[0].primary_access_key
  } : {}

  # var.services with db_env / db_secret_env merged into the one service that
  # talks to Postgres, and media_env / media_secret_env merged into every
  # media_service_keys entry.
  services_resolved = {
    for k, s in var.services : k => merge(s, {
      container = merge(s.container, {
        env = merge(
          try(s.container.env, {}),
          k == local.db_service_key ? local.db_env : {},
          contains(local.media_service_keys, k) ? local.media_env : {},
        )
      })
      secret_env = merge(
        s.secret_env,
        k == local.db_service_key ? local.db_secret_env : {},
        contains(local.media_service_keys, k) ? local.media_secret_env : {},
      )
    })
  }

  db_secrets = local.db_enabled ? {
    "spring-datasource-url"      = module.postgres[0].jdbc_url
    "spring-datasource-username" = module.postgres[0].administrator_login
    "spring-datasource-password" = random_password.db[0].result
  } : {}

  # Durable Key Vault record of every secret injected into a container
  # (kebab-cased), so a human / migration tooling can retrieve them without
  # reading Terraform state. Same role the out-of-band kubectl secrets played
  # in the Helm setup (mailjet-secret, anthropic-secret, azure-postgres-secret).
  app_secrets = merge([
    for k, s in local.services_resolved : {
      for ek, ev in s.secret_env : replace(lower(ek), "_", "-") => ev
    }
  ]...)
}

# ── Database — Azure Database for PostgreSQL, Flexible Server (Burstable) ─────

resource "random_password" "db" {
  count = local.db_enabled ? 1 : 0

  length      = 28
  min_upper   = 2
  min_lower   = 2
  min_numeric = 2
  min_special = 2
  # Azure rejects '/', '@', '"', ' ' and a few others in the admin password.
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

module "postgres" {
  source = "../../modules/postgres-flexible"
  count  = local.db_enabled ? 1 : 0

  name                = var.database.server_name
  resource_group_name = var.resource_group_name
  location            = var.location

  database_name          = var.database.database_name
  administrator_login    = var.database.administrator_login
  administrator_password = random_password.db[0].result

  postgres_version             = var.database.postgres_version
  sku_name                     = var.database.sku_name
  storage_mb                   = var.database.storage_mb
  auto_grow_enabled            = var.database.auto_grow_enabled
  backup_retention_days        = var.database.backup_retention_days
  geo_redundant_backup_enabled = var.database.geo_redundant_backup_enabled
  zone                         = var.database.zone
  allow_azure_services         = var.database.allow_azure_services
  firewall_rules               = var.database.firewall_rules

  tags = local.common_tags
}

# ── Container Apps Environment (Consumption plan, scale-to-zero) ──────────────

module "environment" {
  source = "../../../azure/modules/container-apps-env"

  name                       = local.stack_name
  location                   = var.location
  resource_group_name        = var.resource_group_name
  enable_monitoring          = var.enable_monitoring
  log_analytics_workspace_id = var.log_analytics_workspace_id
  tags                       = local.common_tags
}

# ── Services — one Container App per entry ───────────────────────────────────

module "services" {
  source   = "../../../azure/modules/container-apps"
  for_each = local.services_resolved

  name                         = "${local.stack_name}-${each.key}"
  resource_group_name          = var.resource_group_name
  container_app_environment_id = module.environment.id
  registry_password            = var.registry_password
  container                    = each.value.container
  secret_env                   = each.value.secret_env
  ingress                      = each.value.ingress
  replicas                     = each.value.replicas

  tags = local.common_tags
}

# ── Media storage — Azure Blob (staff photos + work-gallery media) ──────────
# The app authenticates with the account key (media_secret_env above), so no
# managed identity / role assignments here.

module "media_storage" {
  source = "../../../azure/modules/blob-media"
  count  = local.media_enabled ? 1 : 0

  resource_group_name = var.resource_group_name
  location            = var.location

  storage_account_name = var.media_storage.storage_account_name
  container_name       = var.media_storage.container_name
  anonymous_blob_read  = var.media_storage.anonymous_blob_read
  cors_allowed_origins = var.media_storage.cors_allowed_origins

  tags = local.common_tags
}

# ── Key Vault ───────────────────────────────────────────────────────────────

module "key_vault" {
  source = "../../../azure/modules/key-vault"

  name                = var.key_vault_name
  location            = var.location
  resource_group_name = var.resource_group_name

  soft_delete_retention_days = var.environment == "dev" || var.environment == "mix" ? 7 : 30
  purge_protection_enabled   = var.environment != "dev" && var.environment != "mix"

  admin_object_ids = var.key_vault_admin_object_ids

  # Durable record of the generated DB credentials + every container secret (the
  # apps read these from their own container env, not from here — this is for
  # humans / migration tooling).
  secrets = merge(local.db_secrets, local.app_secrets)

  tags = local.common_tags
}

# ── Domain verification token ───────────────────────────────────────────────
# Environment-scoped; the same value is used for every `asuid.<sub>` TXT record.
# Exposed as an output so the dns-update stack can write those records.

data "azapi_resource" "environment" {
  type        = "Microsoft.App/managedEnvironments@2024-03-01"
  resource_id = module.environment.id

  response_export_values = ["properties.customDomainConfiguration.customDomainVerificationId"]
}

# ── Custom domain bindings + Azure-managed certificates (phase 2) ────────────
# Requires the asuid TXT + CNAME (written by dns-update from a prior apply) to
# already resolve publicly. azapi blocks on create until the cert reaches
# Succeeded, so a first run before DNS has propagated will error — re-apply once
# `dig asuid.<sub>.<domain> TXT` returns the token.

resource "azapi_resource" "managed_cert" {
  for_each = local.domains_to_bind

  type      = "Microsoft.App/managedEnvironments/managedCertificates@2024-03-01"
  name      = "${local.stack_name}-${each.key}-cert"
  parent_id = module.environment.id
  location  = var.location

  body = {
    properties = {
      subjectName             = each.value
      domainControlValidation = "CNAME"
    }
  }

  response_export_values = ["id"]
}

resource "azurerm_container_app_custom_domain" "this" {
  for_each = local.domains_to_bind

  name                                     = each.value
  container_app_id                         = module.services[each.key].id
  container_app_environment_certificate_id = azapi_resource.managed_cert[each.key].id
  certificate_binding_type                 = "SniEnabled"
}
