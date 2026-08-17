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
  value = {
    for k, v in azurerm_cdn_frontdoor_custom_domain.this : k => v.validation_token
  }
}

output "endpoint_ids" {
  description = "Map of logical app name → Front Door endpoint resource ID (for DNS alias records)"
  value = {
    for k, v in azurerm_cdn_frontdoor_endpoint.this : k => v.id
  }
}
