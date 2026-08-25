# Pipeline (stages 3-4 of the environment-level flow; stages 1-2 —
# resource_group and dns_bootstrapping — run before this stack is invoked):
#   3a. Storage Accounts   — one static-website storage account per SPA
#   3b. Front Door mapping — CDN profile/origins/endpoints, origins pointed
#       at each storage account's web host; custom domains registered here
#   4.  Subdomain DNS      — CNAME/A records pointing each subdomain at its
#       Front Door endpoint (never at storage directly — Front Door is what
#       provides custom-domain TLS, SPA rewrite, and wildcard routing)

locals {
  frontend_name = "${var.name}-${var.environment}-fe"

  common_tags = {
    Project     = "multi-tenant-salon"
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  # DNS subdomain for each app: "@" for apex, otherwise the prefix before .<domain>
  cdn_dns_subdomains = {
    for k, h in var.cdn_custom_hostnames : k => (
      h == var.domain ? "@" : trimsuffix(h, ".${var.domain}")
    )
  }

  # _dnsauth.<subdomain> TXT record name for Front Door ownership validation
  cdn_dnsauth_names = {
    for k, sub in local.cdn_dns_subdomains : k => (
      sub == "@" ? "_dnsauth" : "_dnsauth.${sub}"
    )
  }

  # The app (if any) whose custom_hostname *is* the apex domain — gets the "@"
  # alias A record. one() errors if two apps both claim the apex, which would
  # be a genuine misconfiguration.
  apex_app_key = one([for k, h in var.cdn_custom_hostnames : k if h == var.domain])

  # Extra hostnames (across all apps) that are exactly the wildcard "*.<domain>".
  # Front Door validates a wildcard custom domain's ownership at the apex
  # "_dnsauth" name, same as the apex domain itself — hence combined below.
  wildcard_extra_keys = flatten([
    for app_key, hostnames in var.cdn_extra_hostnames : [
      for i, h in hostnames : "${app_key}--extra-${i}" if h == "*.${var.domain}"
    ]
  ])

  # The app (if any) serving the wildcard subdomain — its endpoint is the
  # wildcard CNAME target. one() errors if two apps both claim the wildcard.
  wildcard_app_key = one([
    for app_key, hostnames in var.cdn_extra_hostnames : app_key if contains(hostnames, "*.${var.domain}")
  ])
}

# ── Stage 3a: Storage Accounts (one per SPA) ──────────────────────────────────

module "storage" {
  source = "../../modules/storage"

  resource_group_name = var.resource_group_name
  location            = var.location
  accounts            = var.storage_accounts
  tags                = local.common_tags
}

# ── Stage 3b: Azure Front Door — mapped 1:1 to the storage accounts above ─────
# Each origin's host_name comes from module.storage.accounts[k].primary_web_host
# (implicit dependency: Front Door is built after storage). custom_hostname
# drives CDN-managed TLS — the profile provisions a free certificate once the
# Stage 4 DNS record below points the subdomain at this endpoint.

module "cdn" {
  source = "../../modules/cdn"

  name                = local.frontend_name
  resource_group_name = var.resource_group_name

  dns_zone_id = var.dns_zone_id

  endpoints = {
    for k, v in var.storage_accounts : k => {
      origin_host     = try(module.storage.accounts[k].primary_web_host, "${v.storage_account_name}.z1.web.core.windows.net")
      custom_hostname = lookup(var.cdn_custom_hostnames, k, null)
      extra_hostnames = lookup(var.cdn_extra_hostnames, k, [])
    }
  }

  tags = local.common_tags
}

# ── Stage 4: map subdomains → Front Door endpoints ────────────────────────────
# Ownership validation TXT records (_dnsauth.*) so Front Door can provision
# managed TLS certificates. CNAME/alias records route each subdomain to its
# Stage 3b Front Door endpoint (module.cdn.endpoints[...] — an implicit
# dependency, so these are always created after Front Door).
# depends_on = [var.dns_zone_id] additionally orders these after the DNS zone
# itself exists (dns-bootstrapping stack): zone_name below is a plain string,
# not an attribute reference, so it carries no dependency of its own — the
# explicit depends_on is what's actually load-bearing for that ordering.

# TXT: _dnsauth.<sub> — one per non-apex custom domain
resource "azurerm_dns_txt_record" "cdn_validation" {
  for_each = {
    for k, v in module.cdn.custom_domain_validation_tokens : k => v
    if can(local.cdn_dnsauth_names[k]) && local.cdn_dnsauth_names[k] != "_dnsauth"
  }

  name                = local.cdn_dnsauth_names[each.key]
  zone_name           = var.domain
  resource_group_name = var.resource_group_name
  ttl                 = 300

  record {
    value = each.value
  }

  depends_on = [var.dns_zone_id]
}

# TXT: _dnsauth (apex) — shared by the apex app (custom_hostname == domain) and
# the wildcard app (extra_hostname == *.<domain>). Both validate at the same
# DNS name, so a single record holds both tokens.
resource "azurerm_dns_txt_record" "cdn_apex_validation" {
  name                = "_dnsauth"
  zone_name           = var.domain
  resource_group_name = var.resource_group_name
  ttl                 = 300

  dynamic "record" {
    for_each = concat(
      [module.cdn.custom_domain_validation_tokens[local.apex_app_key]],
      [for k in local.wildcard_extra_keys : module.cdn.custom_domain_validation_tokens[k]]
    )
    content {
      value = record.value
    }
  }

  depends_on = [var.dns_zone_id]
}

# Alias A record for apex domain (@) → Front Door endpoint
# Azure DNS alias records let you point the root domain to a Front Door endpoint
# without violating the DNS spec that forbids CNAME at apex.
resource "azurerm_dns_a_record" "cdn_apex" {
  name                = "@"
  zone_name           = var.domain
  resource_group_name = var.resource_group_name
  ttl                 = 300
  target_resource_id  = module.cdn.endpoint_ids[local.apex_app_key]

  depends_on = [var.dns_zone_id]
}

# CNAME records for all subdomains → their Front Door endpoints
resource "azurerm_dns_cname_record" "cdn" {
  for_each = {
    for k, sub in local.cdn_dns_subdomains : k => sub
    if sub != "@"
  }

  name                = each.value
  zone_name           = var.domain
  resource_group_name = var.resource_group_name
  ttl                 = 300
  record              = module.cdn.endpoints[each.key]

  depends_on = [var.dns_zone_id]
}

# Wildcard CNAME: *.<domain> → the wildcard app's Front Door endpoint
# Catches all tenant subdomains (e.g. mysalon.salonsaas.org) not matched by explicit records above.
# No count guard here (kept as a plain resource, like cdn_apex above) so this
# resource's address doesn't change — errors fast at apply if no app declares
# a *.<domain> extra hostname, rather than silently skipping the record.
resource "azurerm_dns_cname_record" "wildcard" {
  name                = "*"
  zone_name           = var.domain
  resource_group_name = var.resource_group_name
  ttl                 = 300
  record              = module.cdn.endpoints[local.wildcard_app_key]

  depends_on = [var.dns_zone_id]
}
