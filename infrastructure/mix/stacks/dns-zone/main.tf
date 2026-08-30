# salonsaas.org is now hosted on Cloudflare. This creates the zone (type
# "full" = Cloudflare is authoritative once the registrar's NS records are
# switched to the name servers in the `name_servers` output). Records are added
# by the dns-update stack, which depends on the frontend / backend module
# outputs.
#
# Migration note: the old Azure DNS zone (azure/stacks/dns-bootstrapping) is
# retired. Apply this stack, recreate every record (dns-update), switch the NS
# records at the registrar, verify, and only then destroy the Azure zone.

resource "cloudflare_zone" "this" {
  account = { id = var.account_id }
  name    = var.zone_name
  type    = "full"
}
