output "distribution_ids" {
  value       = { for k, v in aws_cloudfront_distribution.this : k => v.id }
  description = "Map of distribution key → CloudFront distribution ID"
}

output "distribution_arns" {
  value       = { for k, v in aws_cloudfront_distribution.this : k => v.arn }
  description = "Map of distribution key → CloudFront distribution ARN"
}

output "distribution_domains" {
  value       = { for k, v in aws_cloudfront_distribution.this : k => v.domain_name }
  description = "Map of distribution key → CloudFront domain name (for Route 53 alias targets)"
}

output "distribution_zone_ids" {
  value       = { for k, v in aws_cloudfront_distribution.this : k => v.hosted_zone_id }
  description = "Map of distribution key → CloudFront hosted zone ID (for Route 53 alias targets)"
}
