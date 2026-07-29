variable "name" {
  type        = string
  description = "Name prefix (used for cluster, service, task family, IAM roles)"
}

variable "aws_region" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "Subnets for the ALB"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Subnets for ECS tasks. Can be the same as public_subnet_ids when assign_public_ip=true"
}

variable "assign_public_ip" {
  type        = bool
  default     = false
  description = "true = tasks get public IPs and can reach the internet directly (no NAT needed). Use for dev."
}

variable "alb_security_group_id" {
  type = string
}

variable "ecs_security_group_id" {
  type = string
}

variable "acm_certificate_arn" {
  type        = string
  description = "ACM cert ARN for api.my-saloon.online in the ALB region"
}

variable "container_name" {
  type    = string
  default = "saloon-backend"
}

variable "container_image" {
  type        = string
  description = "Full image URI, e.g. ghcr.io/org/repo:sha (overwritten by CI at deploy time)"
  default     = "ghcr.io/samitkumarpatel/multi-tenant-saloon:latest"
}

variable "ghcr_credentials_secret_arn" {
  type        = string
  default     = ""
  description = "Secrets Manager ARN holding {username, password} for ghcr.io. Leave empty for public images."
}

variable "container_port" {
  type    = number
  default = 8080
}

variable "spring_profile" {
  type    = string
  default = "prod"
}

variable "task_cpu" {
  type    = number
  default = 512
}

variable "task_memory" {
  type    = number
  default = 1024
}

variable "desired_count" {
  type    = number
  default = 1
}

variable "min_tasks" {
  type    = number
  default = 1
}

variable "max_tasks" {
  type    = number
  default = 5
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "enable_deletion_protection" {
  type    = bool
  default = false
}

variable "secrets_manager_arns" {
  type        = list(string)
  description = "ARNs of Secrets Manager secrets the task execution role can read"
}

variable "secret_arn_db_url" {
  type = string
}

variable "secret_arn_db_username" {
  type = string
}

variable "secret_arn_db_password" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
