output "profile_name" {
  value = azurerm_cdn_frontdoor_profile.this.name
}

output "endpoints" {
  description = "Map of logical app name → Front Door endpoint hostname (*.z01.azurefd.net)"
  value = {
    for k, v in azurerm_cdn_frontdoor_endpoint.this : k => v.host_name
  }
}

output "custom_domain_validation_tokens" {
  description = "Add these as DNS TXT records (_dnsauth.<subdomain>) to validate custom domain ownership"
  value = merge(
    { for k, v in azurerm_cdn_frontdoor_custom_domain.this : k => v.validation_token },
    { for k, v in azurerm_cdn_frontdoor_custom_domain.extra : k => v.validation_token }
  )
}

output "extra_domain_validation_tokens" {
  description = "Validation tokens for extra custom domains (e.g. wildcard), keyed by app--extra-N"
  value = {
    for k, v in azurerm_cdn_frontdoor_custom_domain.extra : k => {
      hostname         = local.extra_domains[k].hostname
      validation_token = v.validation_token
    }
  }
}

output "endpoint_ids" {
  description = "Map of logical app name → Front Door endpoint resource ID (for DNS alias records)"
  value = {
    for k, v in azurerm_cdn_frontdoor_endpoint.this : k => v.id
  }
}
