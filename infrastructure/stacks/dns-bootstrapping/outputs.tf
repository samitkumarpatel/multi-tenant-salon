output "zone_id" {
  value       = module.dns_zone.zone_id
  description = "Route 53 hosted zone ID"
}

output "name_servers" {
  value       = module.dns_zone.name_servers
  description = "NS records to set at your domain registrar — required before Phase 2"
}

output "certificate_arns" {
  value = merge(
    { for k, v in aws_acm_certificate_validation.global : k => v.certificate_arn },
    { for k, v in aws_acm_certificate_validation.regional : k => v.certificate_arn },
  )
  description = "Map of certificate key → validated ARN. Reference by the key you defined in var.certificates."
}
