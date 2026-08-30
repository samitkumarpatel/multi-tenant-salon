output "zone_id" {
  value = cloudflare_zone.this.id
}

output "zone_name" {
  value = cloudflare_zone.this.name
}

output "name_servers" {
  description = "Set these two NS records at the domain registrar to delegate salonsaas.org to Cloudflare."
  value       = cloudflare_zone.this.name_servers
}

output "status" {
  description = "\"pending\" until the registrar NS switch propagates, then \"active\"."
  value       = cloudflare_zone.this.status
}
