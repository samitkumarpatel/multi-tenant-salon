# One storage account per web app mirrors the S3-bucket-per-app pattern.
# Each account enables static website hosting so the $web container serves SPA files.
# Storage account names must be globally unique, 3-24 chars, lowercase alphanumeric only.

resource "azurerm_storage_account" "this" {
  for_each = var.accounts

  name                      = each.value.storage_account_name
  resource_group_name       = var.resource_group_name
  location                  = var.location
  account_tier              = "Standard"
  account_replication_type  = "LRS"
  account_kind              = "StorageV2"
  shared_access_key_enabled = true

  # cors_rule must be nested inside blob_properties, not at the top level
  blob_properties {
    dynamic "cors_rule" {
      for_each = each.value.cors_rules
      content {
        allowed_headers    = cors_rule.value.allowed_headers
        allowed_methods    = cors_rule.value.allowed_methods
        allowed_origins    = cors_rule.value.allowed_origins
        exposed_headers    = cors_rule.value.exposed_headers
        max_age_in_seconds = cors_rule.value.max_age_seconds
      }
    }
  }

  tags = merge(var.tags, { app = each.key })
}

resource "azurerm_storage_account_static_website" "this" {
  for_each           = var.accounts
  storage_account_id = azurerm_storage_account.this[each.key].id
  index_document     = each.value.index_document
  error_404_document = each.value.error_404_document
}
