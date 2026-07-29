output "zone_id" {
  value = data.aws_route53_zone.this.zone_id
}

output "apex_fqdn" {
  value = length(aws_route53_record.apex) > 0 ? aws_route53_record.apex[0].fqdn : null
}

output "api_fqdn" {
  value = length(aws_route53_record.api) > 0 ? aws_route53_record.api[0].fqdn : null
}
