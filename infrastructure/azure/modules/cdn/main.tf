# Azure Front Door Standard — replaces Azure CDN Classic (deprecated).
# One profile shared across all endpoints; one endpoint per web app.
# SPA 404 handling is provided by the storage account's error_404_document
# setting (Storage returns 200 with index.html body for unknown paths).

resource "azurerm_cdn_frontdoor_profile" "this" {
  name                = "${var.name}-afd"
  resource_group_name = var.resource_group_name
  sku_name            = "Standard_AzureFrontDoor"
  tags                = var.tags
}

# ── Per-app origin groups ─────────────────────────────────────────────────────

resource "azurerm_cdn_frontdoor_origin_group" "this" {
  for_each = var.endpoints

  name                     = "${each.key}-og"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.this.id

  load_balancing {
    sample_size                 = 4
    successful_samples_required = 3
  }

  health_probe {
    path                = "/"
    protocol            = "Https"
    interval_in_seconds = 100
  }
}

# ── Per-app origins ───────────────────────────────────────────────────────────

resource "azurerm_cdn_frontdoor_origin" "this" {
  for_each = var.endpoints

  name                          = "${each.key}-origin"
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.this[each.key].id

  enabled                        = true
  host_name                      = each.value.origin_host
  origin_host_header             = each.value.origin_host
  certificate_name_check_enabled = true
  http_port                      = 80
  https_port                     = 443
}

# ── Per-app endpoints ─────────────────────────────────────────────────────────
# Endpoint names must be globally unique; they form <name>.z01.azurefd.net

resource "azurerm_cdn_frontdoor_endpoint" "this" {
  for_each = var.endpoints

  name                     = "${var.name}-${each.key}"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.this.id
  tags                     = merge(var.tags, { app = each.key })
}

# ── Per-app routes ────────────────────────────────────────────────────────────

resource "azurerm_cdn_frontdoor_route" "this" {
  for_each = var.endpoints

  name                          = "${each.key}-route"
  cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.this[each.key].id
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.this[each.key].id
  cdn_frontdoor_origin_ids      = [azurerm_cdn_frontdoor_origin.this[each.key].id]

  supported_protocols    = ["Http", "Https"]
  patterns_to_match      = ["/*"]
  forwarding_protocol    = "HttpsOnly"
  https_redirect_enabled = true
  link_to_default_domain = true

  cdn_frontdoor_custom_domain_ids = concat(
    each.value.custom_hostname != null ? [azurerm_cdn_frontdoor_custom_domain.this[each.key].id] : [],
    [for k, d in azurerm_cdn_frontdoor_custom_domain.extra : d.id if local.extra_domains[k].app_key == each.key]
  )

  depends_on = [azurerm_cdn_frontdoor_origin.this]
}

# ── Custom domains + Front Door managed TLS ───────────────────────────────────
# After apply, add the _dnsauth.<subdomain> TXT record shown in the
# azurerm_cdn_frontdoor_custom_domain.validation_token output to prove
# domain ownership; Front Door then auto-provisions the TLS certificate.

resource "azurerm_cdn_frontdoor_custom_domain" "this" {
  for_each = { for k, v in var.endpoints : k => v if v.custom_hostname != null }

  name                     = replace(each.value.custom_hostname, ".", "-")
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.this.id
  host_name                = each.value.custom_hostname
  dns_zone_id              = var.dns_zone_id

  tls {
    certificate_type = "ManagedCertificate"
    minimum_version  = "TLS12"
  }
}

# ── Extra custom domains (e.g. wildcard *.salonsaas.org) ──────────────────────

locals {
  extra_domains = merge([
    for app_key, ep in var.endpoints : {
      for i, h in ep.extra_hostnames :
      "${app_key}--extra-${i}" => { app_key = app_key, hostname = h }
    }
  ]...)
}

resource "azurerm_cdn_frontdoor_custom_domain" "extra" {
  for_each = local.extra_domains

  name                     = replace(replace(each.value.hostname, ".", "-"), "*", "wildcard")
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.this.id
  host_name                = each.value.hostname
  dns_zone_id              = var.dns_zone_id

  tls {
    certificate_type = "ManagedCertificate"
    minimum_version  = "TLS12"
  }
}
