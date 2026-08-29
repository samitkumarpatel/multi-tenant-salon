output "project_name" {
  value = cloudflare_pages_project.this.name
}

output "pages_hostname" {
  description = "The <project>.pages.dev hostname — use as the CNAME target for the custom domain."
  value       = cloudflare_pages_project.this.subdomain
}

output "custom_domain" {
  value = var.custom_domain
}
