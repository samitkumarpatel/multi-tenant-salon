variable "environment" {
  type = string
}

variable "domain" {
  type        = string
  description = "Root domain, e.g. salonsaas.org. Informational — custom domains are passed explicitly per app."
}

variable "account_id" {
  type        = string
  description = "Cloudflare account ID that owns all Pages projects in this environment."
}

variable "production_branch" {
  type    = string
  default = "main"
}

# One entry per frontend SPA. Key is the logical app name (matches the dev env's
# storage_accounts keys); `project` is the globally-unique Pages project name;
# `custom_domain` is the FQDN to attach (its CNAME is created by dns-update).
variable "apps" {
  type = map(object({
    project       = string
    custom_domain = optional(string)
  }))
}
