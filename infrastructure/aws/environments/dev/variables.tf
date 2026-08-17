variable "ghcr_token" {
  type        = string
  sensitive   = true
  description = "GHCR pull credentials JSON. Set via TF_VAR_ghcr_token env var before running terraform apply."
}

variable "mailjet_api_key" {
  type        = string
  sensitive   = true
  description = "Mailjet API key. Set via TF_VAR_mailjet_api_key env var before running terraform apply."
}

variable "mailjet_api_secret" {
  type        = string
  sensitive   = true
  description = "Mailjet API secret. Set via TF_VAR_mailjet_api_secret env var before running terraform apply."
}
