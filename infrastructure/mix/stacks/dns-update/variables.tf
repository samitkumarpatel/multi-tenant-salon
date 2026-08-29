variable "zone_name" {
  type        = string
  description = "Name of the existing Azure DNS zone (e.g. salonsaas.org) to add records to."
}

variable "resource_group_name" {
  type        = string
  description = "Resource group that holds the DNS zone."
}

variable "dns_zone_id" {
  type        = string
  default     = null
  description = "DNS zone resource ID. Used only via depends_on to order these records after the zone exists — record resources address the zone by name, which carries no dependency of its own."
}

# Records whose values come from other stack outputs (Pages *.pages.dev hosts,
# Container App FQDNs, asuid verification tokens). Same shape as the dns-zone
# module's `records` input.
variable "dns_records" {
  type = map(object({
    type   = string # "A" | "CNAME" | "TXT" | "MX"
    name   = string # "@" for apex
    values = list(string)
    ttl    = optional(number, 300)
  }))
  default = {}
}
