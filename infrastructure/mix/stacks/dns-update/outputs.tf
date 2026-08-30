output "record_ids" {
  description = "Map of record key → Cloudflare record ID."
  value       = { for k, r in cloudflare_dns_record.this : k => r.id }
}

output "record_names" {
  value = { for k, r in cloudflare_dns_record.this : k => r.name }
}
