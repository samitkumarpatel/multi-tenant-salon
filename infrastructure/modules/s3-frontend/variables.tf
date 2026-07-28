variable "name" {
  type        = string
  description = "Bucket name prefix, e.g. 'my-saloon'"
}

variable "force_destroy" {
  type        = bool
  default     = false
  description = "Allow terraform destroy to empty and delete buckets"
}

variable "tags" {
  type    = map(string)
  default = {}
}
