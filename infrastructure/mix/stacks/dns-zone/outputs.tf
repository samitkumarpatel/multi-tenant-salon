output "zone_id" {
  value = data.azurerm_dns_zone.this.id
}

output "zone_name" {
  value = data.azurerm_dns_zone.this.name
}

output "resource_group_name" {
  description = "Resource group of the zone — pass to dns-update so its record resources land in the right RG."
  value       = var.resource_group_name
}

output "name_servers" {
  description = "Informational. Delegation is already handled by the environment that owns the zone."
  value       = data.azurerm_dns_zone.this.name_servers
}
