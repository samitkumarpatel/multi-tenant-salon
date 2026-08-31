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
  # Splat (not identity[0]) so a not-yet-created identity resolves to a plan-time
  # unknown rather than null — a null here would break a downstream for_each/count.
  value = one(azurerm_container_app.this.identity[*].principal_id)
}
