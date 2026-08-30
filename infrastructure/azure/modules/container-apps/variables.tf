variable "name" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "container_app_environment_id" {
  type = string
}

variable "registry_server" {
  type    = string
  default = "ghcr.io"
}

variable "registry_username" {
  type    = string
  default = "samitkumarpatel"
}

variable "registry_password" {
  description = "Registry password (e.g. a GHCR PAT with read:packages). Omit for public images."
  type        = string
  default     = null
  sensitive   = true
}

variable "container" {
  type = object({
    name   = string
    image  = string
    cpu    = optional(number, 0.25)
    memory = optional(string, "0.5Gi")
    env    = optional(map(string), {})
    # map of volume name -> mount path; volume name must also appear in var.volumes
    volume = optional(map(string), {})
  })
}

variable "secret_env" {
  description = <<-EOT
    Environment variables whose values are stored as Container App secrets rather
    than inline. Map of ENV_VAR_NAME => value. Each entry renders both a
    `secret` block (name = the env var lowercased with `_`→`-`) and an `env`
    block that references it via `secret_name`. Mirrors a Kubernetes
    `envFrom.secretRef` where every secret key maps 1:1 to an env var.
  EOT
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "ingress" {
  type = object({
    allow_insecure_connections = optional(bool, false)
    external_enabled           = bool
    target_port                = number
    exposed_port               = optional(number)
    transport                  = optional(string, "auto")
  })
}

variable "app_env_storage_name" {
  description = "Storage-mount name from the container-apps-env module's storage_names output."
  type        = string
  default     = null
}

variable "volumes" {
  description = "Volume names to mount from app_env_storage_name; each must have a matching entry in var.container.volume."
  type        = list(string)
  default     = []
}

# min = 0 scales the app to zero when idle (Consumption-plan billing stops with
# it) — keep it 0 for dev/low-traffic services rather than bumping it "to be safe";
# that's what removes the need for an on/off schedule, unlike the AKS node pool.
variable "replicas" {
  type = object({
    min = number
    max = number
  })
  default = {
    min = 0
    max = 1
  }
}

variable "tags" {
  type    = map(string)
  default = {}
}
