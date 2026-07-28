variable "environment" {
  type    = string
  default = "dev"
}

variable "name" {
  type    = string
  default = "my-saloon"
}

variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "domain" {
  type    = string
  default = "my-saloon.online"
}

variable "db_name" {
  type    = string
  default = "saloon"
}

variable "db_username" {
  type    = string
  default = "saloon_app"
}

variable "api_acm_certificate_arn" {
  type        = string
  description = "ACM certificate ARN for api.my-saloon.online in ap-south-1. Set via TF_VAR_api_acm_certificate_arn in .env"
}

variable "ghcr_image" {
  type    = string
  default = "samitkumarpatel/multi-tenant-saloon"
}

variable "ghcr_username" {
  type        = string
  description = "GitHub username for ghcr.io. Set via TF_VAR_ghcr_username in .env"
}

variable "ghcr_pat" {
  type        = string
  sensitive   = true
  description = "GitHub PAT with read:packages scope. Set via TF_VAR_ghcr_pat in .env"
}
