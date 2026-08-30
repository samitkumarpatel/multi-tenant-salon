output "project_name" {
  value = cloudflare_pages_project.this.name
}

output "pages_hostname" {
  description = "The <project>.pages.dev hostname — use as the CNAME target for the custom domains."
  value       = cloudflare_pages_project.this.subdomain
}

output "custom_domains" {
  value = var.custom_domains
}
