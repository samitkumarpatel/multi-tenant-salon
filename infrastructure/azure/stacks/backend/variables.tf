variable "name" {
  type = string
}

variable "environment" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "resource_group_id" {
  type = string
}

variable "location" {
  type    = string
  default = "eastus"
}

# ── DNS ────────────────────────────────────────────────────────────────────────

variable "domain" {
  type        = string
  description = "Root domain (DNS zone name), e.g. salonsaas.org — used as zone_name for the ingress A records."
}

variable "dns_zone_id" {
  type        = string
  description = "Azure DNS zone resource ID. Used (via depends_on) to order the ingress A records after the zone exists."
  default     = null
}

# One A record per subdomain, all pointing at the same nginx-ingress static IP.
# Unlike the AWS backend's `ingress` (map of hostname -> ECS service key, since
# ALB routing rules are defined in Terraform there), host-based routing here is
# done by the in-cluster nginx Ingress resource (Helm-deployed, not Terraform) —
# so Terraform only needs to know which subdomains to point at the shared IP.
variable "ingress_subdomains" {
  type        = list(string)
  default     = []
  description = "Subdomains (e.g. [\"api\", \"auth\"]) that get an A record pointing at the nginx-ingress static IP."
}

# ── Networking ─────────────────────────────────────────────────────────────────

variable "vnet_address_space" {
  type    = list(string)
  default = ["10.0.0.0/16"]
}

variable "aks_subnet_cidr" {
  type    = string
  default = "10.0.1.0/24"
}

# ── AKS ───────────────────────────────────────────────────────────────────────

variable "kubernetes_version" {
  type    = string
  default = ""
}

variable "system_node_count" {
  type    = number
  default = 2
}

variable "system_vm_size" {
  type    = string
  default = "Standard_D2s_v3"
}

variable "spot_vm_size" {
  type    = string
  default = "Standard_D2s_v3"
}

variable "spot_min_count" {
  type    = number
  default = 1
}

variable "spot_max_count" {
  type    = number
  default = 5
}

variable "enable_monitoring" {
  type    = bool
  default = true
}

# ── PostgreSQL disk ───────────────────────────────────────────────────────────

variable "postgres_disk_size_gb" {
  type    = number
  default = 32
}

variable "postgres_disk_sku" {
  type    = string
  default = "Premium_LRS"
}

# ── Key Vault ──────────────────────────────────────────────────────────────────

variable "key_vault_name" {
  type        = string
  description = "Globally unique Key Vault name (3-24 chars, alphanumeric + hyphens)"
}

