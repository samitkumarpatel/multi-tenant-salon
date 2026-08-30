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

# One entry per frontend SPA. Key is the logical app name; `project` is the
# globally-unique Pages project name; `custom_domains` is the list of FQDNs to
# attach (sub-domain, apex and/or "*.salonsaas.org"). The DNS records for them
# are created by the dns-update stack.
variable "apps" {
  type = map(object({
    project        = string
    custom_domains = optional(list(string), [])
  }))
}
