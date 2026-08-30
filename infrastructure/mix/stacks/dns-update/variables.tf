variable "zone_id" {
  type        = string
  description = "Cloudflare zone ID (from the dns-zone stack)."
}

# One entry per record. Unlike the old Azure module, Cloudflare stores one value
# per record resource, so multi-value sets (e.g. several apex TXT strings) are
# expressed as several map entries.
#
#   type     : A | AAAA | CNAME | TXT | MX
#   name     : FQDN (e.g. "admin.salonsaas.org") or the zone apex name
#   content  : the record value (target host / IP / text / MX exchange)
#   ttl      : 1 = automatic (required for proxied records); default 1
#   proxied  : orange-cloud. Only honoured for A/AAAA/CNAME; ignored otherwise.
#              Pages hostnames -> true. Azure Container Apps hostnames -> false
#              (Azure serves their TLS and validates the CNAME directly).
#   priority : MX only.
variable "dns_records" {
  type = map(object({
    type     = string
    name     = string
    content  = string
    ttl      = optional(number, 1)
    proxied  = optional(bool, false)
    priority = optional(number)
  }))
  default = {}
}
