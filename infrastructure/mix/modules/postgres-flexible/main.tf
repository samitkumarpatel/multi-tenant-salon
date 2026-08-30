# Azure Database for PostgreSQL – Flexible Server (Burstable tier by default).
# Public access + firewall rules — the Container Apps Consumption environment has
# no VNet integration, so private networking is not an option here without also
# reworking the environment.

resource "azurerm_postgresql_flexible_server" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location

  version                = var.postgres_version
  administrator_login    = var.administrator_login
  administrator_password = var.administrator_password

  sku_name   = var.sku_name
  storage_mb = var.storage_mb

  auto_grow_enabled            = var.auto_grow_enabled
  backup_retention_days        = var.backup_retention_days
  geo_redundant_backup_enabled = var.geo_redundant_backup_enabled
  zone                         = var.zone

  public_network_access_enabled = true

  tags = var.tags

  lifecycle {
    # Azure can return a different availability zone than requested (or an empty
    # string) after creation; don't let that force a replacement on every plan.
    ignore_changes = [zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "this" {
  name      = var.database_name
  server_id = azurerm_postgresql_flexible_server.this.id
  collation = "en_US.utf8"
  charset   = "UTF8"
}

# 0.0.0.0/0.0.0.0 is the documented special rule meaning "allow all Azure
# services", NOT "allow the whole internet".
resource "azurerm_postgresql_flexible_server_firewall_rule" "azure_services" {
  count            = var.allow_azure_services ? 1 : 0
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.this.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "extra" {
  for_each         = var.firewall_rules
  name             = each.key
  server_id        = azurerm_postgresql_flexible_server.this.id
  start_ip_address = each.value.start_ip_address
  end_ip_address   = each.value.end_ip_address
}
