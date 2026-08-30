output "worker_name" {
  description = "Cloudflare Worker that reverse-proxies *.<zone_name> onto the salonsaas-public Pages deployment."
  value       = cloudflare_workers_script.tenant_proxy.script_name
}

output "route_pattern" {
  description = "The wildcard Worker route pattern."
  value       = cloudflare_workers_route.tenant_wildcard.pattern
}

output "wildcard_record" {
  description = "The proxied wildcard DNS record name."
  value       = cloudflare_dns_record.tenant_wildcard.name
}

output "reserved_route_patterns" {
  description = "Hostnames explicitly excluded from the tenant wildcard proxy (served normally)."
  value       = [for r in cloudflare_workers_route.reserved : r.pattern]
}
