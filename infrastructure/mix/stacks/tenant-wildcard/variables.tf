variable "account_id" {
  type        = string
  description = "Cloudflare account ID that owns the zone and the Worker."
}

variable "zone_id" {
  type        = string
  description = "Cloudflare zone ID for the domain (from the dns-zone stack)."
}

variable "zone_name" {
  type        = string
  description = "Apex domain, e.g. salonsaas.org. The wildcard record and Worker route are *.<zone_name>."
}

variable "pages_host" {
  type        = string
  description = <<-EOT
    The <project>.pages.dev host of the salon-public-website Pages project.
    Every tenant sub-domain (<salon>.<zone_name>) is reverse-proxied onto this
    by the Worker. Cloudflare Pages cannot own a wildcard custom domain, so the
    Pages project keeps only its *.pages.dev host and this Worker fronts it.
  EOT
}

variable "reserved_hosts" {
  type        = list(string)
  default     = []
  description = <<-EOT
    FQDNs under <zone_name> that must NOT be caught by the tenant wildcard
    Worker (the other frontend apps + the api/auth backends). Each gets a more
    specific route bound to no Worker, which — being more specific — wins over
    "*.<zone_name>/*" and lets Cloudflare serve that host normally.
  EOT
}

variable "script_name" {
  type        = string
  default     = "salonsaas-tenant-wildcard"
  description = "Name of the Cloudflare Worker that reverse-proxies *.<zone_name> onto pages_host."
}

variable "compatibility_date" {
  type        = string
  default     = "2024-11-11"
  description = "Workers runtime compatibility date for the proxy script."
}

variable "placeholder_origin_ip" {
  type        = string
  default     = "192.0.2.1"
  description = "IPv4 for the proxied wildcard A record. RFC 5737 TEST-NET-1 by default — never actually contacted, the Worker answers every request."
}
