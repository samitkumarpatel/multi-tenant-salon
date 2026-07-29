output "zone_id" {
  value       = module.dns_bootstrap.zone_id
  description = "Route 53 hosted zone ID"
}

output "name_servers" {
  value       = module.dns_bootstrap.name_servers
  description = "NS records to set at your domain registrar — do this before applying the main stack"
}

output "certificate_arn" {
  value       = module.dns_bootstrap.certificate_arn
  description = "Validated ACM certificate ARN (us-east-1)"
}
