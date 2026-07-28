output "zone_id" {
  value = data.aws_route53_zone.this.zone_id
}

output "apex_fqdn" {
  value = aws_route53_record.apex.fqdn
}

output "api_fqdn" {
  value = aws_route53_record.api.fqdn
}
