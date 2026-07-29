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

variable "certificate_arn" {
  type        = string
  description = "Validated ACM certificate ARN in us-east-1 (output of the bootstrap stack)."
}

variable "zone_id" {
  type        = string
  description = "Route 53 hosted zone ID for the domain (output of the bootstrap stack)."
}
