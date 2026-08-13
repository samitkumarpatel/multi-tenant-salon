variable "name" {
  type        = string
  description = "Name prefix for all shared resources (cluster, ALB, log groups)"
}

variable "aws_region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Subnets for the ALB (and for tasks when assign_public_ip=true)"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Subnets for ECS tasks when assign_public_ip=false"
}

variable "assign_public_ip" {
  type        = bool
  default     = false
  description = "true = tasks get public IPs so they can reach the internet directly (no NAT). Use in dev with default VPC subnets."
}

variable "alb_security_group_id" {
  type = string
}

variable "ecs_security_group_id" {
  type = string
}

variable "internal" {
  type        = bool
  default     = false
  description = "When true the ALB is internal (no public IP) with a plain HTTP/80 listener. Use when API Gateway sits in front via VPC Link."
}

variable "acm_certificate_arn" {
  type        = string
  default     = null
  description = "ACM cert ARN for the HTTPS listener. Required when internal=false; ignored when internal=true."
}

variable "enable_deletion_protection" {
  type    = bool
  default = false
}

# ── Services ──────────────────────────────────────────────────────────────────
# Each key becomes the service name suffix and the ECS container name.
# Services with path_prefix=null are workers — they run as ECS services but
# are not attached to the ALB and receive no inbound traffic.

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

    health_check_path             = optional(string, "/health")
    health_check_grace_period_sec = optional(number, 0)
    log_retention_days            = optional(number, 30)

    env_vars        = optional(map(string), {})
    secret_arns     = optional(map(string), {})
    ghcr_secret_arn = optional(string, "")
    s3_bucket_arns  = optional(list(string), [])
  }))
  description = "Map of services to deploy. Key is used as the service name suffix and container name. Services not referenced in http_routes are workers with no ALB attachment."
}

variable "ingress" {
  type        = map(string)
  default     = {}
  description = "Hostname-to-service routing rules for the ALB. Keys are full hostnames (e.g. \"api.my-saloon.online\"); values are service keys from var.services."
}

variable "container_insights" {
  type        = bool
  default     = false
  description = "Enable CloudWatch Container Insights on the ECS cluster. Generates custom metrics (~$0.30/metric/month beyond the 10 free tier metrics). Disable for dev."
}

variable "tags" {
  type    = map(string)
  default = {}
}
