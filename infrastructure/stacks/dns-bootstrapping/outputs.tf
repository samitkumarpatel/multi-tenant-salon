output "zone_id" {
  value       = module.dns_zone.zone_id
  description = "Route 53 hosted zone ID"
}

output "name_servers" {
  value       = module.dns_zone.name_servers
  description = "NS records to set at your domain registrar — required before Phase 2"
}

output "certificate_arn" {
  value       = module.dns_cert.certificate_arn
  description = "Validated ACM certificate ARN (us-east-1)"
}
