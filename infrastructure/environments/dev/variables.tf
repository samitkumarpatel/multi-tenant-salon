variable "ghcr_token" {
  type      = string
  sensitive = true
  description = "GHCR pull credentials JSON. Set via TF_VAR_ghcr_token env var before running terraform apply."
}
