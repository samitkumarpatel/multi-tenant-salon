# Key Vault name must be globally unique, 3-24 chars, alphanumeric and hyphens only.
variable "name" {
  type = string
}

variable "location" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "aks_kubelet_object_id" {
  type    = string
  default = null
}

variable "soft_delete_retention_days" {
  type    = number
  default = 7
}

variable "purge_protection_enabled" {
  type    = bool
  default = false
}

variable "secrets" {
  type      = map(string)
  default   = {}
  sensitive = true
}

variable "tags" {
  type    = map(string)
  default = {}
}
