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
  type        = string
  default     = "my-saloon.online"
  description = "Root domain. ACM cert for this + *.this must exist in us-east-1 before apply."
}
