data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "this" {
  name                       = var.name
  location                   = var.location
  resource_group_name        = var.resource_group_name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = var.soft_delete_retention_days
  purge_protection_enabled   = var.purge_protection_enabled
  rbac_authorization_enabled = false
  tags                       = var.tags

  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    secret_permissions = [
      "Get", "List", "Set", "Delete", "Purge", "Recover"
    ]
  }

  # Extra humans/identities (by AAD object ID) that get full secret access —
  # e.g. an operator who needs to read the generated DB password.
  dynamic "access_policy" {
    for_each = toset(var.admin_object_ids)
    content {
      tenant_id = data.azurerm_client_config.current.tenant_id
      object_id = access_policy.value

      secret_permissions = [
        "Get", "List", "Set", "Delete", "Purge", "Recover"
      ]
    }
  }
}

resource "azurerm_key_vault_secret" "this" {
  for_each = nonsensitive(var.secrets)

  name         = each.key
  value        = each.value
  key_vault_id = azurerm_key_vault.this.id
}
