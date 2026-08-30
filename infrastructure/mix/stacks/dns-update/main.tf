# Record-only stack: writes every salonsaas.org record into the Cloudflare zone
# created by the dns-zone stack. Split from dns-zone so records whose values are
# module outputs (Pages *.pages.dev hosts, Container App FQDNs, the asuid
# verification token) can be applied after those modules.

resource "cloudflare_dns_record" "this" {
  for_each = var.dns_records

  zone_id = var.zone_id
  name    = each.value.name
  type    = each.value.type
  content = each.value.content
  ttl     = each.value.ttl

  # proxied is only valid for A/AAAA/CNAME; sending it for TXT/MX is rejected.
  proxied  = contains(["A", "AAAA", "CNAME"], each.value.type) ? each.value.proxied : null
  priority = each.value.type == "MX" ? each.value.priority : null
}
