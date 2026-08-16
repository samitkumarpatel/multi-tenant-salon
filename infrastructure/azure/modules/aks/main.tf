locals {
  name = var.name
}

# ── Optional monitoring workspace ─────────────────────────────────────────────

resource "azurerm_log_analytics_workspace" "this" {
  count               = var.enable_monitoring ? 1 : 0
  name                = "${local.name}-logs"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

# ── AKS cluster ───────────────────────────────────────────────────────────────

resource "azurerm_kubernetes_cluster" "this" {
  name                = local.name
  location            = var.location
  resource_group_name = var.resource_group_name
  dns_prefix          = local.name
  kubernetes_version  = var.kubernetes_version

  # System pool: on-demand nodes — hosts K8s system pods and PostgreSQL.
  # PostgreSQL must NOT run on the spot pool (eviction = unclean shutdown → data risk).
  default_node_pool {
    name            = "system"
    node_count      = var.system_node_count
    vm_size         = var.system_vm_size
    vnet_subnet_id  = var.subnet_id
    os_disk_size_gb = 50
    type            = "VirtualMachineScaleSets"
    node_labels     = { "workload-type" = "system" }
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin    = "azure"
    load_balancer_sku = "standard"
    outbound_type     = "loadBalancer"
  }

  dynamic "oms_agent" {
    for_each = var.enable_monitoring ? [1] : []
    content {
      log_analytics_workspace_id = azurerm_log_analytics_workspace.this[0].id
    }
  }

  tags = var.tags
}

# ── Spot node pool — stateless microservices only ─────────────────────────────
# Tainted with kubernetes.azure.com/scalesetpriority=spot:NoSchedule so only
# workloads that explicitly tolerate spot land here.

resource "azurerm_kubernetes_cluster_node_pool" "spot" {
  name                  = "spot"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.this.id
  vm_size               = var.spot_vm_size
  priority              = "Spot"
  eviction_policy       = "Delete"
  spot_max_price        = -1

  auto_scaling_enabled = true
  min_count            = var.spot_min_count
  max_count            = var.spot_max_count

  vnet_subnet_id  = var.subnet_id
  os_disk_size_gb = 50

  node_labels = {
    "workload-type"                         = "spot"
    "kubernetes.azure.com/scalesetpriority" = "spot"
  }

  node_taints = ["kubernetes.azure.com/scalesetpriority=spot:NoSchedule"]

  tags = var.tags
}

# ── Managed disk for PostgreSQL persistent storage ────────────────────────────
# Mount this disk as a PersistentVolume in your Postgres pod spec.
# The disk lives independently of the node so data survives node replacement.

resource "azurerm_managed_disk" "postgres" {
  name                 = "${local.name}-postgres-data"
  location             = var.location
  resource_group_name  = var.resource_group_name
  storage_account_type = var.postgres_disk_sku
  create_option        = "Empty"
  disk_size_gb         = var.postgres_disk_size_gb
  tags                 = var.tags
}

# Grant AKS kubelet identity rights to attach the managed disk
data "azurerm_resource_group" "this" {
  name = var.resource_group_name
}

resource "azurerm_role_assignment" "aks_disk" {
  scope                = data.azurerm_resource_group.this.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_kubernetes_cluster.this.kubelet_identity[0].object_id
}
