variable "name" {
  type        = string
  description = "Name prefix used for tagging and log bucket references"
}

variable "cf_logs_bucket" {
  type        = string
  description = "Name (not domain) of the S3 bucket that receives CloudFront access logs"
}

# ── Distributions ─────────────────────────────────────────────────────────────
# Each key becomes one aws_cloudfront_distribution.
# Origins, path behaviors, and error responses are per-distribution.

variable "distributions" {
  type = map(object({
    aliases            = list(string)
    certificate_arn    = string
    default_origin_key = string
    log_prefix         = optional(string, "")

    # Pre-computed origin objects keyed by bucket key. The stack builds this
    # from module.s3 outputs so the module stays provider-agnostic.
    origins = map(object({
      domain_name = string
      oac_id      = string
    }))

    # Ordered path-based cache behaviors (evaluated before the default)
    path_behaviors = optional(list(object({
      path_pattern = string
      origin_key   = string
    })), [])

    # SPA-friendly error handling: map 403/404 to an index page
    custom_error_responses = optional(list(object({
      error_code         = number
      response_code      = optional(number, 200)
      response_page_path = string
    })), [])

    # Optional function attachments
    cf_function_arn           = optional(string, null) # viewer-request CloudFront Function
    lambda_edge_qualified_arn = optional(string, null) # origin-request Lambda@Edge (us-east-1)
  }))
  description = "Map of CloudFront distributions to create. One distribution per key."
}

variable "tags" {
  type    = map(string)
  default = {}
}
