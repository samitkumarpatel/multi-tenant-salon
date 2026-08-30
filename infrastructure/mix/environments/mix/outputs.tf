output "azure_resource_group" {
  description = "The Azure resource group mix owns and puts all its backend resources in (Container Apps, PostgreSQL, Key Vault)."
  value       = azurerm_resource_group.shared.name
}

output "name_servers" {
  description = "Switch salonsaas.org's NS records at the domain registrar to these two Cloudflare name servers, then wait for `dns_zone_status` to read \"active\"."
  value       = module.dns.name_servers
}

output "dns_zone_status" {
  description = "\"pending\" until the registrar NS switch propagates; \"active\" once Cloudflare is authoritative."
  value       = module.dns.status
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
  description = "Map of app key → list of public URLs served by its Pages project."
  value       = { for k, hosts in module.frontend.custom_domains : k => [for h in hosts : "https://${h}"] }
}

output "backend_fqdns" {
  description = "Container App default FQDNs (before custom-domain binding)."
  value       = module.backend.fqdns
}

output "backend_urls" {
  value = {
    api  = "https://api.salonsaas.org"
    auth = "https://auth.salonsaas.org"
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
