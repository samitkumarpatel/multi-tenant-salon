variable "name" {
  type = string
}

variable "subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs where the VPC Link ENIs are placed"
}

variable "security_group_ids" {
  type        = list(string)
  description = "Security group IDs attached to the VPC Link ENIs"
}

variable "alb_listener_arn" {
  type        = string
  description = "Internal ALB HTTP listener ARN — the integration target for both REST and WebSocket"
}

variable "domain" {
  type        = string
  description = "Root domain, e.g. my-saloon.online"
}

variable "certificate_arn" {
  type        = string
  description = "Regional ACM certificate ARN (must cover api.<domain> and ws.<domain> — a wildcard *.domain works)"
}

variable "zone_id" {
  type        = string
  description = "Route 53 hosted zone ID for creating api.domain and ws.domain records"
}

variable "tags" {
  type    = map(string)
  default = {}
}
