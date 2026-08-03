variable "environment" {
  type    = string
  default = "dev"
}

variable "name" {
  type    = string
  default = "my-saloon"
}

variable "domain" {
  type        = string
  default     = "my-saloon.online"
  description = "Root domain."
}

variable "regional_certificate_arn" {
  type        = string
  description = "Validated ACM certificate ARN in the deployment region (output of the bootstrap stack, used for API Gateway v2 custom domains)."
}

variable "zone_id" {
  type        = string
  description = "Route 53 hosted zone ID for the domain (output of the bootstrap stack)."
}

variable "aws_region" {
  type        = string
  default     = "eu-north-1"
  description = "AWS region for the backend resources (must match the provider region)."
}

# ── Services ──────────────────────────────────────────────────────────────────
# DB secret ARNs (SPRING_DATASOURCE_*) are automatically injected by this stack
# for every service — do not include them in secret_arns here.

variable "services" {
  type = map(object({
    image     = string
    image_tag = optional(string, "latest")

    container_port = optional(number, 8080)
    cpu            = optional(number, 512)
    memory         = optional(number, 1024)

    desired_count = optional(number, 1)
    min_tasks     = optional(number, 1)
    max_tasks     = optional(number, 5)

    health_check_path  = optional(string, "/health")
    log_retention_days = optional(number, 30)

    env_vars        = optional(map(string), {})
    secret_arns     = optional(map(string), {})
    ghcr_secret_arn = optional(string, "")
  }))
  description = "Services to run on ECS. DB credentials are injected automatically. Services not referenced in routes.http are workers with no ALB attachment."
}

# ── Routes ────────────────────────────────────────────────────────────────────

variable "routes" {
  type = object({
    http = map(string)
  })
  description = "Routing rules. http maps path prefixes to service keys (e.g. { \"/\" = \"api\" })."
}
