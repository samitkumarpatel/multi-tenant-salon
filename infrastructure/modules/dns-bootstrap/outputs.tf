output "zone_id" {
  value       = aws_route53_zone.this.zone_id
  description = "Route 53 hosted zone ID"
}

output "name_servers" {
  value       = aws_route53_zone.this.name_servers
  description = "NS records to set at your domain registrar"
}

output "certificate_arn" {
  value       = aws_acm_certificate_validation.this.certificate_arn
  description = "Validated ACM certificate ARN (us-east-1) — safe to reference in CloudFront after apply"
}
