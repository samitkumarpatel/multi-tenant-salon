variable "name" {
  type = string
}

variable "location" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "resource_group_id" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "kubernetes_version" {
  type    = string
  default = ""
}

# ── System node pool ──────────────────────────────────────────────────────────

variable "system_node_count" {
  type    = number
  default = 2
}

variable "system_vm_size" {
  type    = string
  default = "Standard_D2s_v3"
}

# ── Spot node pool ────────────────────────────────────────────────────────────

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

# ── PostgreSQL disk ───────────────────────────────────────────────────────────

variable "postgres_disk_size_gb" {
  type    = number
  default = 32
}

variable "postgres_disk_sku" {
  type    = string
  default = "Premium_LRS"
}

# ── Monitoring ────────────────────────────────────────────────────────────────

variable "enable_monitoring" {
  type    = bool
  default = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
