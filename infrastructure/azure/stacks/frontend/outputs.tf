output "resource_group_name" {
  value = var.resource_group_name
}

output "storage_accounts" {
  description = "Map of logical app name → storage account details"
  value       = module.storage.accounts
}

output "cdn_endpoints" {
  description = "Map of logical app name → Front Door endpoint hostname (*.z01.azurefd.net)"
  value       = module.cdn.endpoints
}

output "custom_domain_validation_tokens" {
  description = "DNS TXT validation tokens for Front Door custom domain TLS certificates"
  value       = module.cdn.custom_domain_validation_tokens
}

output "cdn_endpoint_ids" {
  description = "Map of logical app name → Front Door endpoint resource ID"
  value       = module.cdn.endpoint_ids
}
