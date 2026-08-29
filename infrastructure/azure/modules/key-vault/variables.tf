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

variable "admin_object_ids" {
  description = "Extra AAD object IDs granted full secret permissions (Get/List/Set/Delete/Purge/Recover). Empty by default."
  type        = list(string)
  default     = []
}

variable "tags" {
  type    = map(string)
  default = {}
}
