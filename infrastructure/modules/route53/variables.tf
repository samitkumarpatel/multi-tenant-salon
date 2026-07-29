variable "domain" {
  type        = string
  description = "Root domain, e.g. my-saloon.online"
}

variable "zone_id" {
  type        = string
  description = "Route 53 hosted zone ID for the domain"
}

variable "cf_main_domain" {
  type        = string
  description = "CloudFront Distribution #1 domain name (apex + www)"
}

variable "cf_main_zone_id" {
  type        = string
  description = "CloudFront Distribution #1 hosted zone ID"
}

variable "cf_wildcard_domain" {
  type        = string
  description = "CloudFront Distribution #2 domain name (wildcard *.domain)"
}

variable "cf_wildcard_zone_id" {
  type        = string
  description = "CloudFront Distribution #2 hosted zone ID"
}

variable "alb_dns_name" {
  type        = string
  default     = null
  description = "ALB DNS name for api.domain. Null skips that record."
}

variable "alb_zone_id" {
  type        = string
  default     = null
  description = "ALB hosted zone ID"
}
