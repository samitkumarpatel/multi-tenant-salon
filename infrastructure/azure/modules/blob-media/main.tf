# Storage account for staff media (profile photos + work-gallery images/video).
#
# The app (net.samitkumar...media.internal.AzureBlobMediaServiceImpl) authenticates
# with the account key and hands the browser a short-lived shared-key SAS to PUT
# each blob. The analytics module's activity-events queue lives on the same
# account and also uses the key. The key is exported (sensitive) for the caller
# to inject as AZURE_STORAGE_ACCOUNT_KEY.
#
# Everything here is management-plane, so it works with the deployer's
# Contributor role (no role-assignment / Owner rights needed).

resource "azurerm_storage_account" "this" {
  name                     = var.storage_account_name
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  access_tier              = "Hot"

  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = true
  allow_nested_items_to_be_public = var.anonymous_blob_read
  public_network_access_enabled   = true

  blob_properties {
    dynamic "cors_rule" {
      for_each = length(var.cors_allowed_origins) > 0 ? [1] : []
      content {
        allowed_origins    = var.cors_allowed_origins
        allowed_methods    = ["GET", "HEAD", "PUT", "OPTIONS"]
        allowed_headers    = ["*"]
        exposed_headers    = ["*"]
        max_age_in_seconds = 3600
      }
    }
  }

  tags = var.tags
}

resource "azurerm_storage_container" "staff_media" {
  name                  = var.container_name
  storage_account_id    = azurerm_storage_account.this.id
  container_access_type = var.anonymous_blob_read ? "blob" : "private"
}
