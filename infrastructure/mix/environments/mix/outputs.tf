output "azure_resource_group" {
  description = "The shared Azure resource group mix's resources were created in (owned by azure/environments/dev)."
  value       = data.azurerm_resource_group.shared.name
}

output "dns_zone" {
  description = "The shared salonsaas.org zone mix writes its records into (owned by the azure environment)."
  value = {
    name                = module.dns.zone_name
    resource_group_name = module.dns.resource_group_name
    name_servers        = module.dns.name_servers
  }
}

output "pages_projects" {
  description = "Map of app key → Cloudflare Pages project name. Pass to `wrangler pages deploy --project-name`."
  value       = module.frontend.project_names
}

output "pages_hostnames" {
  description = "Map of app key → <project>.pages.dev host."
  value       = module.frontend.pages_hostnames
}

output "frontend_urls" {
  value = { for k, h in module.frontend.custom_domains : k => "https://${h}" }
}

output "backend_fqdns" {
  description = "Container App default FQDNs (before custom-domain binding)."
  value       = module.backend.fqdns
}

output "backend_urls" {
  value = {
    api  = "https://api-m.salonsaas.org"
    auth = "https://auth-m.salonsaas.org"
  }
}

output "custom_domain_verification_id" {
  description = "asuid TXT value for the Container Apps custom domains (already written by dns-update)."
  value       = module.backend.custom_domain_verification_id
}

output "backend_egress_ips" {
  description = "Add these to the PostgreSQL firewall allow-list."
  value       = module.backend.egress_ips
}

output "key_vault_uri" {
  value = module.backend.key_vault_uri
}

output "database" {
  description = "mix managed PostgreSQL (Flexible Server, Burstable B1ms). Admin password: `terraform output -raw database_password` or Key Vault secret spring-datasource-password."
  value       = module.backend.database
}

output "database_password" {
  value     = module.backend.database_password
  sensitive = true
}
