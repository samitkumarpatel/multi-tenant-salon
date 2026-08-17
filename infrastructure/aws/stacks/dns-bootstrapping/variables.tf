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

variable "dns_records" {
  type = map(object({
    type    = string
    name    = string
    ttl     = optional(number, 300)
    records = list(string)
  }))
  default     = {}
  description = "DNS records to create. Key is a stable identifier used in state. Name is a subdomain or '@' for the zone apex. TXT values longer than 255 chars are automatically split into multi-string records."
}
