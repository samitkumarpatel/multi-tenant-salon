variable "environment" {
  type = string
}

variable "domain" {
  type        = string
  description = "Root domain for the Route 53 hosted zone."
}

variable "certificates" {
  type = map(object({
    domain                    = string
    subject_alternative_names = optional(list(string), [])
    # true  = us-east-1 (required for CloudFront distributions)
    # false = deployment region (required for API Gateway v2 custom domains)
    global = optional(bool, false)
  }))
  default     = {}
  description = "ACM certificates to create and validate. Reference outputs by key in frontend/backend modules."
}
