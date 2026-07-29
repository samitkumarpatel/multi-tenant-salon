variable "environment" {
  type = string
}

variable "name" {
  type = string
}

variable "domain" {
  type        = string
  description = "Root domain. ACM cert for this + *.this will be created in us-east-1."
}
