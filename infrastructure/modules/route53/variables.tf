variable "domain" {
  type        = string
  description = "Root domain, e.g. my-saloon.online (must exist as a Route 53 hosted zone)"
}

variable "cf_main_domain" {
  type        = string
  default     = null
  description = "CloudFront Distribution #1 domain name (apex + www). Null skips those records."
}

variable "cf_main_zone_id" {
  type        = string
  default     = null
  description = "CloudFront Distribution #1 hosted zone ID"
}

variable "cf_wildcard_domain" {
  type        = string
  default     = null
  description = "CloudFront Distribution #2 domain name (wildcard *.domain). Null skips that record."
}

variable "cf_wildcard_zone_id" {
  type        = string
  default     = null
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
