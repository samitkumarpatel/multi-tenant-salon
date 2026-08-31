output "storage_account_name" {
  value = azurerm_storage_account.this.name
}

output "storage_account_id" {
  value = azurerm_storage_account.this.id
}

output "primary_blob_endpoint" {
  description = "https://<account>.blob.core.windows.net/"
  value       = azurerm_storage_account.this.primary_blob_endpoint
}

output "container_name" {
  value = azurerm_storage_container.staff_media.name
}

output "media_base_url" {
  description = "Base URL for a stored blob's public address — set as the app's MEDIA_STAFF_CDN_BASE_URL. publicUrl = \"<media_base_url>/<key>\"."
  value       = "${trimsuffix(azurerm_storage_account.this.primary_blob_endpoint, "/")}/${azurerm_storage_container.staff_media.name}"
}

output "primary_access_key" {
  description = "Storage account primary key — inject as AZURE_STORAGE_ACCOUNT_KEY (Container App secret)."
  value       = azurerm_storage_account.this.primary_access_key
  sensitive   = true
}
