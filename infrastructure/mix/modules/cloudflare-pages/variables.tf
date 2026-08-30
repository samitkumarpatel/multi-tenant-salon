variable "account_id" {
  type        = string
  description = "Cloudflare account ID that owns the Pages project."
}

variable "project_name" {
  type        = string
  description = "Pages project name. Globally unique per account, lowercase, becomes the <name>.pages.dev subdomain."
}

variable "production_branch" {
  type        = string
  default     = "main"
  description = "Branch name treated as production for direct-upload deployments (wrangler --branch)."
}

# A direct-upload project has no build_config / source block — content is pushed
# by `wrangler pages deploy` in CI, not built by Cloudflare. Leaving both unset
# is what makes this a direct-upload project.

variable "custom_domains" {
  type        = list(string)
  default     = []
  description = "FQDNs to attach to the project — sub-domain, apex, and/or the \"*.salonsaas.org\" wildcard. Matching DNS records are created in the dns-update stack."
}
