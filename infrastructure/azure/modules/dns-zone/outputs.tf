output "zone_id" {
  value = azurerm_dns_zone.this.id
}

output "zone_name" {
  value = azurerm_dns_zone.this.name
}

output "name_servers" {
  description = "Delegate these NS records at your registrar"
  value       = azurerm_dns_zone.this.name_servers
}
