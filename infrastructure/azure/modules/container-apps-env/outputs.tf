output "id" {
  value = azurerm_container_app_environment.this.id
}

output "name" {
  value = azurerm_container_app_environment.this.name
}

output "storage_names" {
  description = "Azure Files storage-mount names, for use as an azurerm_container_app volume's storage_name."
  value       = [for s in azurerm_container_app_environment_storage.this : s.name]
}
