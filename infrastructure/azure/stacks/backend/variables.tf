variable "name" {
  type = string
}

variable "environment" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "location" {
  type    = string
  default = "eastus"
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
  default = "1.31"
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

# ── Secrets ───────────────────────────────────────────────────────────────────

variable "ghcr_token" {
  type      = string
  sensitive = true
}

variable "mailjet_api_key" {
  type      = string
  sensitive = true
}

variable "mailjet_api_secret" {
  type      = string
  sensitive = true
}

variable "postgres_password" {
  type      = string
  sensitive = true
}
