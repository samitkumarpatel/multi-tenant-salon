locals {
  backend_name = "${var.name}-${var.environment}"

  common_tags = {
    Project     = "multi-tenant-salon"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ── Virtual Network ────────────────────────────────────────────────────────────

module "vnet" {
  source = "../../modules/vnet"

  name                = local.backend_name
  location            = var.location
  resource_group_name = var.resource_group_name
  address_space       = var.vnet_address_space
  aks_subnet_cidr     = var.aks_subnet_cidr
  tags                = local.common_tags
}

# ── AKS Cluster ────────────────────────────────────────────────────────────────
# System pool hosts PostgreSQL (on-demand, stable).
# Spot pool hosts stateless microservices (interruptible).

module "aks" {
  source = "../../modules/aks"

  name                = local.backend_name
  location            = var.location
  resource_group_name = var.resource_group_name
  resource_group_id   = var.resource_group_id
  subnet_id           = module.vnet.aks_subnet_id
  kubernetes_version  = var.kubernetes_version

  system_node_count = var.system_node_count
  system_vm_size    = var.system_vm_size

  spot_vm_size   = var.spot_vm_size
  spot_min_count = var.spot_min_count
  spot_max_count = var.spot_max_count

  postgres_disk_size_gb = var.postgres_disk_size_gb
  postgres_disk_sku     = var.postgres_disk_sku

  enable_monitoring = var.enable_monitoring

  tags = local.common_tags
}

# ── AKS Network Contributor ────────────────────────────────────────────────────
# The AKS control-plane identity must be able to read/manage public IPs in the
# resource group so it can attach a static IP to a LoadBalancer Service
# (e.g. the nginx ingress controller).

resource "azurerm_role_assignment" "aks_network_contributor" {
  principal_id         = module.aks.cluster_identity_principal_id
  role_definition_name = "Network Contributor"
  scope                = var.resource_group_id
}

# ── AKS Disk Attach permissions ────────────────────────────────────────────────
# The CSI external-attacher (runs in the AKS managed control plane, uses the
# cluster identity) needs Contributor on the disk to call Azure Compute attach
# APIs. The kubelet identity needs it to format and mount the disk on the node.
# Both are scoped to the postgres disk only, not the whole resource group.

resource "azurerm_role_assignment" "aks_cluster_disk_contributor" {
  principal_id         = module.aks.cluster_identity_principal_id
  role_definition_name = "Contributor"
  scope                = module.aks.postgres_disk_id
}

resource "azurerm_role_assignment" "aks_kubelet_disk_contributor" {
  principal_id         = module.aks.kubelet_identity_object_id
  role_definition_name = "Contributor"
  scope                = module.aks.postgres_disk_id
}

# ── Key Vault ──────────────────────────────────────────────────────────────────
# Name must be globally unique, 3-24 chars, alphanumeric + hyphens.

module "key_vault" {
  source = "../../modules/key-vault"

  name                = var.key_vault_name
  location            = var.location
  resource_group_name = var.resource_group_name

  soft_delete_retention_days = var.environment == "dev" ? 7 : 30
  purge_protection_enabled   = var.environment != "dev"

  tags = local.common_tags
}

# ── nginx Ingress — static public IP ──────────────────────────────────────────
# One shared IP for all backend services (api, auth, …) routed by hostname via
# nginx ingress controller. Pass this IP when installing ingress-nginx:
#   --set controller.service.loadBalancerIP=$(terraform output -raw nginx_ingress_ip)

resource "azurerm_public_ip" "nginx_ingress" {
  # Name intentionally matches resource_group_name, not backend_name — preserves
  # the resource's identity from when this lived directly in the environment
  # root module (name = "${local.resource_group_name}-nginx-ingress" there).
  # Changing it would force a replace, handing out a new static IP.
  name                = "${var.resource_group_name}-nginx-ingress"
  resource_group_name = var.resource_group_name
  location            = var.location
  allocation_method   = "Static"
  sku                 = "Standard"

  tags = local.common_tags
}

resource "azurerm_dns_a_record" "ingress" {
  for_each = toset(var.ingress_subdomains)

  name                = each.value
  zone_name           = var.domain
  resource_group_name = var.resource_group_name
  ttl                 = 300
  records             = [azurerm_public_ip.nginx_ingress.ip_address]

  depends_on = [var.dns_zone_id]
}
