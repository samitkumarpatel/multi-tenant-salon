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
    extra_hostnames = optional(list(string), [])
  }))
}

variable "dns_zone_id" {
  type        = string
  description = "Azure DNS zone resource ID — enables Front Door to validate ownership via the Azure DNS API, so managed TLS certs are provisioned without waiting for public DNS propagation."
  default     = null
}

variable "tags" {
  type    = map(string)
  default = {}
}
