variable "account_id" {
  type        = string
  description = "Cloudflare account ID that will own the zone."
}

variable "zone_name" {
  type        = string
  description = "Name of the DNS zone, e.g. salonsaas.org."
}
