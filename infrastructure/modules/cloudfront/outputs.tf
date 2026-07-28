output "main_distribution_id" {
  value = aws_cloudfront_distribution.main.id
}

output "main_distribution_arn" {
  value = aws_cloudfront_distribution.main.arn
}

output "main_distribution_domain" {
  value = aws_cloudfront_distribution.main.domain_name
}

output "main_distribution_zone_id" {
  value = aws_cloudfront_distribution.main.hosted_zone_id
}

output "wildcard_distribution_id" {
  value = aws_cloudfront_distribution.wildcard.id
}

output "wildcard_distribution_arn" {
  value = aws_cloudfront_distribution.wildcard.arn
}

output "wildcard_distribution_domain" {
  value = aws_cloudfront_distribution.wildcard.domain_name
}

output "wildcard_distribution_zone_id" {
  value = aws_cloudfront_distribution.wildcard.hosted_zone_id
}
