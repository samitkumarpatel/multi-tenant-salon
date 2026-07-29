output "zone_id" {
  value = var.zone_id
}

output "apex_fqdn" {
  value = aws_route53_record.apex.fqdn
}

output "api_fqdn" {
  value = length(aws_route53_record.api) > 0 ? aws_route53_record.api[0].fqdn : null
}
