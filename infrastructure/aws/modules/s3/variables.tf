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

variable "cors_rules" {
  description = "Optional CORS rules for direct-upload via pre-signed URLs. Leave empty for static-website-only buckets."
  type = list(object({
    allowed_headers = optional(list(string), ["*"])
    allowed_methods = list(string)
    allowed_origins = list(string)
    expose_headers  = optional(list(string), ["ETag"])
    max_age_seconds = optional(number, 3000)
  }))
  default = []
}
