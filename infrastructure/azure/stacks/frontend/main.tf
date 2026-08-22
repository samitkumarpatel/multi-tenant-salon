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

# ── Storage Accounts (one per SPA) ────────────────────────────────────────────

module "storage" {
  source = "../../modules/storage"

  resource_group_name = var.resource_group_name
  location            = var.location
  accounts            = var.storage_accounts
  tags                = local.common_tags
}

# ── Azure CDN ─────────────────────────────────────────────────────────────────
# Endpoints map 1:1 with storage accounts. custom_hostname drives
# CDN-managed TLS — the CDN profile provisions a free certificate once
# the CNAME record in dns-bootstrapping points to the endpoint host.

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

# ── Front Door DNS records ─────────────────────────────────────────────────────
# Ownership validation TXT records (_dnsauth.*) so Front Door can provision
# managed TLS certificates. CNAME/alias records route traffic to the endpoints.
# depends_on = [var.dns_zone_id] orders these after the DNS zone itself exists
# (dns-bootstrapping stack), since zone_name below is a plain string with no
# other data dependency on it.

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
