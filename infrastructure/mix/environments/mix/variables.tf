variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID that owns the Pages projects."
}

variable "azure_resource_group" {
  type        = string
  default     = "multi-tenant-salon-dev"
  description = "The single Azure resource group shared by azure/environments/dev and mix. azure/dev creates and owns it; mix looks it up and drops its Container Apps env, Key Vault and DNS records into it. Must match azure/environments/dev's resource_group_name."
}

variable "ghcr_token" {
  type        = string
  sensitive   = true
  description = "GHCR PAT with read:packages — used by every Container App pulling a private ghcr.io image."
}

variable "bind_custom_domains" {
  type        = bool
  default     = false
  description = "Phase toggle. Leave false for the first apply (creates apps + DNS records); set true on a second apply once the asuid/CNAME records have propagated, to bind api-m/auth-m with managed TLS certs."
}

variable "key_vault_admin_object_ids" {
  description = "AAD object IDs granted full secret access on salon-saas-mix-kv, on top of the Terraform service principal. Default is the repo owner (samitkumarpatel@live.com guest)."
  type        = list(string)
  default     = ["f889f64b-60db-45be-ab84-dbc0d6489d3f"]
}

variable "postgres_client_ips" {
  type        = map(string)
  default     = {}
  description = <<-EOT
    Extra public IPv4 addresses allowed through the PostgreSQL firewall, as
    name => single IP (e.g. { laptop = "203.0.113.7" }). EMPTY BY DEFAULT — only
    the always-on "Allow Azure services" rule applies, which is what lets the
    Container Apps and AKS deployments reach the DB (both egress from Azure IP
    space). Add your workstation ad-hoc without editing files:

      terraform apply -var 'postgres_client_ips={"laptop":"'"$(curl -s ifconfig.me)"'"}'

    or export TF_VAR_postgres_client_ips='{"laptop":"203.0.113.7"}'.
  EOT
}
