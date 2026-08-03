variable "environment" {
  type    = string
  default = "dev"
}

variable "name" {
  type    = string
  default = "my-saloon"
}

variable "domain" {
  type        = string
  default     = "my-saloon.online"
  description = "Root domain."
}

variable "zone_id" {
  type        = string
  description = "Route 53 hosted zone ID (output of the bootstrap stack)."
}

# Validated ACM certificate ARNs keyed by the certificate name defined in
# dns-bootstrapping. Passed from the environment layer.
variable "certificate_arns" {
  type        = map(string)
  description = "Map of certificate key → validated ACM ARN (output of dns-bootstrapping)."
}

# ── S3 Buckets ────────────────────────────────────────────────────────────────

variable "buckets" {
  type = map(object({
    force_destroy = optional(bool, false)
  }))
  description = "S3 buckets to create. Key is used as the bucket name suffix and as the origin key in distributions."
}

# ── CloudFront Distributions ──────────────────────────────────────────────────

variable "distributions" {
  type = map(object({
    aliases            = list(string)
    certificate_key    = string  # key in var.certificate_arns
    default_origin_key = string  # must be a key in var.buckets
    log_prefix         = optional(string, "")

    # Additional S3 origins beyond the default (must also be keys in var.buckets)
    extra_origins = optional(list(string), [])

    path_behaviors = optional(list(object({
      path_pattern = string
      origin_key   = string
    })), [])

    custom_error_responses = optional(list(object({
      error_code         = number
      response_code      = optional(number, 200)
      response_page_path = string
    })), [])

  }))
  description = "CloudFront distributions to create. Each entry maps aliases → S3 origins."
}

# ── Route 53 Records ──────────────────────────────────────────────────────────

variable "dns_records" {
  type = map(object({
    subdomain        = string # "" for apex, "www", "admin", "*", etc.
    distribution_key = string # key in var.distributions
  }))
  default     = {}
  description = "Route 53 A ALIAS records to create, each pointing a subdomain at a CloudFront distribution."
}
