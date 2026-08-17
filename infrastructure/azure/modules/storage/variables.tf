variable "resource_group_name" {
  type = string
}

variable "location" {
  type = string
}

# Map key = logical app name (e.g. "admin-web").
# storage_account_name must be globally unique, 3-24 chars, lowercase alphanumeric.
variable "accounts" {
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

variable "tags" {
  type    = map(string)
  default = {}
}
