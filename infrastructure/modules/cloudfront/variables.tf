variable "name" {
  type = string
}

variable "domain" {
  type        = string
  description = "Root domain, e.g. my-saloon.online"
}

variable "main_web_bucket_domain" {
  type        = string
  description = "Regional domain of the main-web S3 bucket"
}

variable "public_web_bucket_domain" {
  type        = string
  description = "Regional domain of the public-web S3 bucket"
}

variable "super_admin_bucket_domain" {
  type        = string
  description = "Regional domain of the super-admin-web S3 bucket"
}

variable "cf_logs_bucket" {
  type        = string
  description = "Name (not domain) of the CloudFront logs S3 bucket"
}

variable "oac_main_web_id" {
  type = string
}

variable "oac_public_web_id" {
  type = string
}

variable "oac_super_admin_id" {
  type = string
}

variable "tags" {
  type    = map(string)
  default = {}
}
