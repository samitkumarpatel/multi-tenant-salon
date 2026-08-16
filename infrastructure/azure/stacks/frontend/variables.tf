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
  default = "eastus"
}

# storage_accounts keys are logical app names; values carry the globally-unique
# storage account name and optional CORS / SPA overrides.
variable "storage_accounts" {
  type = map(object({
    storage_account_name = string
    index_document       = optional(string, "index.html")
    error_404_document   = optional(string, "index.html")
    cors_rules = optional(list(object({
      allowed_headers  = list(string)
      allowed_methods  = list(string)
      allowed_origins  = list(string)
      exposed_headers  = optional(list(string), [])
      max_age_seconds  = optional(number, 3600)
    })), [])
  }))
}

# Map of logical app name → custom FQDN for the CDN endpoint.
# Omit a key (or set null) to skip custom domain + TLS for that endpoint.
variable "cdn_custom_hostnames" {
  type    = map(string)
  default = {}
}
