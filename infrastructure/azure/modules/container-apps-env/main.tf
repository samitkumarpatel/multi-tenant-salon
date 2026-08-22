# ── Optional monitoring workspace ─────────────────────────────────────────────
# Only created when enable_monitoring is true and no existing workspace was
# passed in — log_analytics_workspace_id is optional on the environment below,
# so leaving monitoring off costs nothing (no workspace, no ingestion/retention bill).

resource "azurerm_log_analytics_workspace" "this" {
  count               = var.enable_monitoring && var.log_analytics_workspace_id == null ? 1 : 0
  name                = "${var.name}-logs"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

# No workload_profile block below => Consumption plan: billed per active
# vCPU/GiB-second instead of an always-on VM. Combined with min_replicas = 0
# on each service (modules/container-apps), an idle environment costs
# ~nothing — unlike AKS, it doesn't need an on/off scheduler for dev.
resource "azurerm_container_app_environment" "this" {
  name                       = var.name
  location                   = var.location
  resource_group_name        = var.resource_group_name
  log_analytics_workspace_id = var.enable_monitoring ? coalesce(var.log_analytics_workspace_id, try(azurerm_log_analytics_workspace.this[0].id, null)) : null
  tags                       = var.tags
}

# ── Optional Azure Files mounts ───────────────────────────────────────────────

data "azurerm_storage_account" "this" {
  count               = var.storage == null ? 0 : 1
  name                = var.storage.account_name
  resource_group_name = var.storage.account_resource_group_name
}

resource "azurerm_storage_share" "this" {
  for_each = var.storage == null ? toset([]) : toset(var.storage.share_names)

  name               = each.value
  storage_account_id = data.azurerm_storage_account.this[0].id
  quota              = 5
}

resource "azurerm_container_app_environment_storage" "this" {
  for_each = azurerm_storage_share.this

  name                         = "${each.key}-azfile"
  container_app_environment_id = azurerm_container_app_environment.this.id
  account_name                 = data.azurerm_storage_account.this[0].name
  share_name                   = each.value.name
  access_key                   = data.azurerm_storage_account.this[0].primary_access_key
  access_mode                  = "ReadWrite"
}
