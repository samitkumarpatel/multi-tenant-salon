output "fqdns" {
  value       = { for k, v in aws_route53_record.this : k => v.fqdn }
  description = "Map of record key → FQDN"
}
