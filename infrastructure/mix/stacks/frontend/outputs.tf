output "pages_hostnames" {
  description = "Map of logical app name → <project>.pages.dev hostname. Use as CNAME targets in the DNS zone."
  value       = { for k, m in module.pages : k => m.pages_hostname }
}

output "project_names" {
  description = "Map of logical app name → Cloudflare Pages project name (pass to `wrangler pages deploy --project-name`)."
  value       = { for k, m in module.pages : k => m.project_name }
}

output "custom_domains" {
  value = { for k, m in module.pages : k => m.custom_domain }
}
