output "environment_id" {
  value = module.environment.id
}

output "fqdns" {
  description = "Map of service key → Container App default FQDN. Use as CNAME targets for the custom sub-domains."
  value       = { for k, s in module.services : k => s.fqdn }
}

output "egress_ips" {
  description = "Per-service outbound IPs — add as PostgreSQL / firewall allow-list entries."
  value       = { for k, s in module.services : k => s.egress_ip }
}

output "custom_domain_verification_id" {
  description = "Environment-scoped token. Write it as the TXT value of asuid.<sub> for every custom sub-domain."
  value       = data.azapi_resource.environment.output.properties.customDomainConfiguration.customDomainVerificationId
}

output "service_domains" {
  description = "Map of service key → declared custom domain (regardless of bind_custom_domains)."
  value       = local.service_domains
}

output "key_vault_uri" {
  value = module.key_vault.vault_uri
}

output "database" {
  description = "Managed PostgreSQL connection info (null when var.database is unset). Password is in Key Vault / the database_password output, not here."
  value = local.db_enabled ? {
    server_name = module.postgres[0].server_name
    fqdn        = module.postgres[0].fqdn
    database    = module.postgres[0].database_name
    username    = module.postgres[0].administrator_login
    jdbc_url    = module.postgres[0].jdbc_url
  } : null
}

output "database_password" {
  description = "Generated PostgreSQL admin password. `terraform output -raw database_password`."
  value       = local.db_enabled ? random_password.db[0].result : null
  sensitive   = true
}
