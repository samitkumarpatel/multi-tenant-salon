# *.<zone_name> tenant routing.
#
# salon-public-website serves every salon's public micro-site on its own
# sub-domain (<salon>.salonsaas.org). Cloudflare Pages rejects a wildcard
# custom domain ("*.salonsaas.org" -> 400 "Domain is invalid"), so instead:
#
#   1. a PROXIED wildcard A record puts every <x>.salonsaas.org on the
#      Cloudflare edge. Its target IP is a throwaway (RFC 5737) — never
#      contacted, because
#   2. a Worker on the route "*.salonsaas.org/*" answers every request by
#      reverse-proxying it onto the salonsaas-public *.pages.dev deployment,
#      preserving the tenant Host.
#   3. more-specific no-Worker routes for the other apps + api/auth
#      (var.reserved_hosts) keep those hostnames on their normal origin.
#
# Universal SSL's free certificate already covers salonsaas.org + *.salonsaas.org
# (one label deep), so tenant sub-domains get HTTPS with no extra config.
# Two-label hosts (a.b.salonsaas.org) are neither covered nor supported —
# tenants are one label deep by design.

resource "cloudflare_workers_script" "tenant_proxy" {
  account_id  = var.account_id
  script_name = var.script_name

  content = templatefile("${path.module}/worker.js.tftpl", {
    pages_host = var.pages_host
  })
  main_module        = "worker.js"
  compatibility_date = var.compatibility_date
}

# The wildcard route — runs the proxy Worker for any <x>.<zone_name>.
resource "cloudflare_workers_route" "tenant_wildcard" {
  zone_id = var.zone_id
  pattern = "*.${var.zone_name}/*"
  script  = cloudflare_workers_script.tenant_proxy.script_name
}

# One more-specific route per reserved host, bound to NO Worker. A more
# specific pattern wins, so "admin.salonsaas.org/*" etc. bypass the wildcard
# proxy and are served normally (their own proxied Pages CNAME / DNS-only
# Container App CNAME).
resource "cloudflare_workers_route" "reserved" {
  for_each = toset(var.reserved_hosts)

  zone_id = var.zone_id
  pattern = "${each.value}/*"
  # script intentionally omitted => request invokes no Worker
}

# Proxied wildcard record — without this, <x>.salonsaas.org is NXDOMAIN and the
# Worker route never gets a chance to run.
resource "cloudflare_dns_record" "tenant_wildcard" {
  zone_id = var.zone_id
  name    = "*.${var.zone_name}"
  type    = "A"
  content = var.placeholder_origin_ip
  ttl     = 1
  proxied = true
}
