variable "name" {
  type = string
}

variable "location" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "enable_monitoring" {
  description = "Attach a Log Analytics workspace for Container Apps logs/metrics. Off by default — ingestion + retention cost money and dev doesn't need it (mirrors modules/aks's enable_monitoring)."
  type        = bool
  default     = false
}

variable "log_analytics_workspace_id" {
  description = "Reuse an existing Log Analytics workspace instead of creating a dedicated one. Ignored when enable_monitoring is false."
  type        = string
  default     = null
}

variable "storage" {
  description = "Optional Azure Files shares (from an existing storage account) to make mountable by container apps in this environment."
  type = object({
    account_name                = string
    account_resource_group_name = string
    share_names                 = list(string)
  })
  default = null
}

variable "tags" {
  type    = map(string)
  default = {}
}
