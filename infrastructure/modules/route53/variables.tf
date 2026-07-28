variable "domain" {
  type        = string
  description = "Root domain, e.g. my-saloon.online (must exist as a Route 53 hosted zone)"
}

variable "cf_main_domain" {
  type        = string
  description = "CloudFront Distribution #1 domain name"
}

variable "cf_main_zone_id" {
  type        = string
  description = "CloudFront Distribution #1 hosted zone ID"
}

variable "cf_wildcard_domain" {
  type        = string
  description = "CloudFront Distribution #2 domain name"
}

variable "cf_wildcard_zone_id" {
  type        = string
  description = "CloudFront Distribution #2 hosted zone ID"
}

variable "alb_dns_name" {
  type        = string
  description = "ALB DNS name for api.my-saloon.online"
}

variable "alb_zone_id" {
  type        = string
  description = "ALB hosted zone ID"
}
