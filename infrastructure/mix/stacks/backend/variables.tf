variable "name" {
  type = string
}

variable "environment" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "location" {
  type    = string
  default = "westeurope"
}

variable "domain" {
  type        = string
  description = "Root domain, e.g. salonsaas.org. Informational — per-service custom domains are passed in the services map."
}

# ── Key Vault ─────────────────────────────────────────────────────────────────

variable "key_vault_name" {
  type        = string
  description = "Globally unique Key Vault name (3-24 chars, alphanumeric + hyphens)."
}

variable "key_vault_admin_object_ids" {
  description = "Extra AAD object IDs granted full secret access on the Key Vault (in addition to the Terraform identity)."
  type        = list(string)
  default     = []
}

# ── Registry ──────────────────────────────────────────────────────────────────

variable "registry_password" {
  type        = string
  default     = null
  sensitive   = true
  description = "GHCR PAT (read:packages) shared by every service pulling a private ghcr.io image."
}

# ── Monitoring ────────────────────────────────────────────────────────────────

variable "enable_monitoring" {
  type    = bool
  default = false
}

variable "log_analytics_workspace_id" {
  type    = string
  default = null
}

# ── Custom domains (two-phase) ───────────────────────────────────────────────
# false  → create the Container Apps only; emit custom_domain_verification_id so
#          the dns-update stack can write the asuid TXT + CNAME records.
# true   → additionally bind each service.custom_domain to its app with an
#          Azure-managed TLS certificate. Only flip this on a second apply, once
#          the DNS records from the first apply have propagated publicly.
variable "bind_custom_domains" {
  type    = bool
  default = false
}

# ── Database (Azure Database for PostgreSQL – Flexible Server) ───────────────
# When set, a Burstable Flexible Server + database is created and its
# SPRING_DATASOURCE_* vars are merged into the `service_key` service's container
# env. The generated admin password is stored in Key Vault (spring-datasource-*)
# and exposed as a sensitive stack output. Leave null to skip DB provisioning
# (e.g. point the app at an external DB via the services map env).
variable "database" {
  type = object({
    service_key                  = optional(string, "api")
    server_name                  = string
    database_name                = optional(string, "salon")
    administrator_login          = optional(string, "postgres")
    sku_name                     = optional(string, "B_Standard_B1ms")
    storage_mb                   = optional(number, 32768)
    postgres_version             = optional(string, "16")
    backup_retention_days        = optional(number, 7)
    geo_redundant_backup_enabled = optional(bool, false)
    auto_grow_enabled            = optional(bool, false)
    zone                         = optional(string, "1")
    allow_azure_services         = optional(bool, true)
    firewall_rules = optional(map(object({
      start_ip_address = string
      end_ip_address   = string
    })), {})
  })
  default = null
}

# ── Media storage (Azure Blob) ─────────────────────────────────────────────
# When set, a Storage account + blob container are created for staff profile
# photos / work-gallery media, and every service in `service_keys` gets a
# system-assigned managed identity with "Storage Blob Data Contributor" +
# "Storage Blob Delegator" (and "Storage Queue Data Contributor" for the
# analytics queue) on it. The app's media env vars — STORAGE_TYPE=AZURE,
# AZURE_STORAGE_ACCOUNT_NAME, MEDIA_STAFF_CONTAINER_NAME, MEDIA_STAFF_CDN_BASE_URL
# — are merged into those services' containers. Leave null to keep STORAGE_TYPE
# as whatever the services map sets (LOCAL by default).
variable "media_storage" {
  type = object({
    storage_account_name = string
    container_name       = optional(string, "staff-media")
    service_keys         = optional(list(string), ["api"])
    cors_allowed_origins = optional(list(string), [])
    anonymous_blob_read  = optional(bool, true)
    grant_queue_access   = optional(bool, true)
  })
  default = null
}

# ── Services ─────────────────────────────────────────────────────────────────
# One Azure Container App per entry; key becomes the app-name suffix
# ("<name>-<environment>-<key>"). Same shape as azure/stacks/container-apps'
# `services`, plus an optional `custom_domain`.
variable "services" {
  type = map(object({
    custom_domain = optional(string)
    container = object({
      name   = string
      image  = string
      cpu    = optional(number, 0.25)
      memory = optional(string, "0.5Gi")
      env    = optional(map(string), {})
      volume = optional(map(string), {})
    })
    # Env vars sourced from Container App secrets (ENV_VAR_NAME => value). Passed
    # straight to the container-apps module's secret_env. For the DB-backed
    # service, SPRING_DATASOURCE_PASSWORD is merged in automatically.
    secret_env = optional(map(string), {})
    ingress = object({
      allow_insecure_connections = optional(bool, false)
      external_enabled           = bool
      target_port                = number
      exposed_port               = optional(number)
      transport                  = optional(string, "auto")
    })
    replicas = optional(object({
      min = number
      max = number
    }), { min = 0, max = 1 })
  }))
  default = {}
}
