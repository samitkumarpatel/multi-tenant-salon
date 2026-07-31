output "zone_id" {
  value       = aws_route53_zone.this.zone_id
  description = "Route 53 hosted zone ID"
}

output "name_servers" {
  value       = aws_route53_zone.this.name_servers
  description = "NS records to set at your domain registrar"
}
