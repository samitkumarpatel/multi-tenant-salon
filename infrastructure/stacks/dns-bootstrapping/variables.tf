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

variable "extra_txt_records" {
  type        = map(string)
  default     = {}
  description = "Additional TXT records to create. Key is the record name (subdomain or @), value is the TXT record value."
}

variable "zoho_mail" {
  type = object({
    mx_servers = optional(list(object({
      priority = number
      host     = string
    })), [])
    spf_includes  = optional(list(string), ["zohomail.eu"])
    dkim_selector = optional(string, "zmail")
    dkim_key      = optional(string, "")
    extra_txt     = optional(list(string), [])
  })
  default     = null
  description = "Zoho Mail DNS records. When set, creates MX, SPF TXT, and DKIM TXT records in the hosted zone."
}
