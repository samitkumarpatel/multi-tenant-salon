variable "name" {
  type = string
}

variable "resource_group_name" {
  type = string
}

# Map key = logical app name (must match storage module key).
# origin_host = storage account primary_web_host (no https://).
# custom_hostname = FQDN for the CDN endpoint (e.g. "admin.salonsaas.org").
#   Set to null to skip custom domain / HTTPS provisioning.
variable "endpoints" {
  type = map(object({
    origin_host     = string
    custom_hostname = optional(string, null)
  }))
}

variable "tags" {
  type    = map(string)
  default = {}
}
