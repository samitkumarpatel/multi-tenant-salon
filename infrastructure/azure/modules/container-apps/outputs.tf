output "id" {
  value = azurerm_container_app.this.id
}

output "fqdn" {
  value = azurerm_container_app.this.ingress[0].fqdn
}

output "egress_ip" {
  description = "Outbound IPs — add as PostgreSQL/firewall allow-list entries."
  value       = azurerm_container_app.this.outbound_ip_addresses
}

output "principal_id" {
  description = "System-assigned managed identity principal (object) ID. null when identity_type is \"None\" or \"UserAssigned\" only."
  value       = try(azurerm_container_app.this.identity[0].principal_id, null)
}
