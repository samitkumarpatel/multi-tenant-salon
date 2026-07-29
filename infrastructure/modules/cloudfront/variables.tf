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

variable "cf_function_arn" {
  type        = string
  default     = null
  description = "ARN of a CloudFront Function to attach at viewer-request on Distribution #1's default behavior. Null skips the association."
}

variable "lambda_edge_qualified_arn" {
  type        = string
  default     = null
  description = "Qualified ARN of a Lambda@Edge function to attach at origin-request on Distribution #2. Must be deployed in us-east-1. Null skips the association."
}

variable "certificate_arn" {
  type        = string
  description = "ARN of a validated ACM certificate in us-east-1 covering the domain and *.domain"
}

variable "tags" {
  type    = map(string)
  default = {}
}
