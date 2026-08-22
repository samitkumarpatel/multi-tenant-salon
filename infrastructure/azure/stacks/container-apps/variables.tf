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

variable "registry_password" {
  description = "GHCR PAT (read:packages), shared by every service that pulls a private ghcr.io image."
  type        = string
  default     = null
  sensitive   = true
}

variable "enable_monitoring" {
  description = "Attach a Log Analytics workspace to the environment. Off by default — costs ingestion + retention (mirrors stacks/backend's enable_monitoring)."
  type        = bool
  default     = false
}

variable "log_analytics_workspace_id" {
  description = "Reuse an existing Log Analytics workspace instead of creating one. Ignored when enable_monitoring is false."
  type        = string
  default     = null
}

# ── Services ───────────────────────────────────────────────────────────────────
# One Container App per entry; the map key becomes the app-name suffix
# (e.g. "api" -> "<name>-<environment>-api").

variable "services" {
  type = map(object({
    container = object({
      name   = string
      image  = string
      cpu    = optional(number, 0.25)
      memory = optional(string, "0.5Gi")
      env    = optional(map(string), {})
      volume = optional(map(string), {})
    })
    ingress = object({
      allow_insecure_connections = optional(bool, false)
      external_enabled           = bool
      target_port                = number
      exposed_port               = optional(number)
      transport                  = optional(string, "auto")
    })
    replicas = optional(object({
      min = number
      max = number
    }), { min = 0, max = 1 })
  }))
  default = {}
}
