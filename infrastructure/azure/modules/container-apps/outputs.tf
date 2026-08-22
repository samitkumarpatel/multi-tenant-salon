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
