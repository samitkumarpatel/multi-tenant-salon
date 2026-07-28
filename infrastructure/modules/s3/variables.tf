variable "name" {
  type        = string
  description = "S3 bucket name"
}

variable "force_destroy" {
  type        = bool
  default     = false
  description = "Allow terraform destroy to empty and delete the bucket"
}

variable "tags" {
  type    = map(string)
  default = {}
}
