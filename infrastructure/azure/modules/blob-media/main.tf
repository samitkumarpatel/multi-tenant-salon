# Storage account for staff media (profile photos + work-gallery images/video).
#
# The app (net.samitkumar...media.internal.AzureBlobMediaServiceImpl) authenticates
# with its managed identity only — no account key, no connection string — and
# hands the browser a short-lived *user-delegation* SAS to PUT each blob. So:
#   * shared_access_key_enabled = false            → keys can't be used at all
#   * the identity gets "Storage Blob Delegator"   → can mint the delegation key
#   * the identity gets "Storage Blob Data Contributor" → the SAS it signs can write
#
# Container/queue creation below goes through the resource-manager plane
# (storage_account_id, not *_name), so it works with the deployer's Contributor
# role even though data-plane keys are disabled.

resource "azurerm_storage_account" "this" {
  name                     = var.storage_account_name
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"
  access_tier              = "Hot"

  min_tls_version                 = "TLS1_2"
  shared_access_key_enabled       = false
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

# ── Data-plane RBAC for the workload identities ──────────────────────────────

resource "azurerm_role_assignment" "blob_data_contributor" {
  for_each = toset(var.application_principal_ids)

  scope                = azurerm_storage_account.this.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = each.value
}

resource "azurerm_role_assignment" "blob_delegator" {
  for_each = toset(var.application_principal_ids)

  scope                = azurerm_storage_account.this.id
  role_definition_name = "Storage Blob Delegator"
  principal_id         = each.value
}

resource "azurerm_role_assignment" "queue_data_contributor" {
  for_each = var.grant_queue_access ? toset(var.application_principal_ids) : toset([])

  scope                = azurerm_storage_account.this.id
  role_definition_name = "Storage Queue Data Contributor"
  principal_id         = each.value
}
