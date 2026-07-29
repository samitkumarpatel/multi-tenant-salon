output "cloudfront_main_id" {
  value       = module.cloudfront.main_distribution_id
  description = "Set as CF_MAIN_DIST_ID in GitHub Actions repository variables"
}

output "cloudfront_wildcard_id" {
  value       = module.cloudfront.wildcard_distribution_id
  description = "Set as CF_WILDCARD_DIST_ID in GitHub Actions repository variables"
}

output "s3_buckets" {
  value       = { for k, v in module.s3 : k => v.bucket_id }
  description = "Map of bucket key → bucket name (main-web, public-web, super-admin-web)"
}

output "cf_logs_bucket" {
  value       = aws_s3_bucket.cf_logs.id
  description = "CloudFront access logs bucket name"
}

output "resource_group_arn" {
  value       = aws_resourcegroups_group.env.arn
  description = "ARN of the AWS Resource Group for this environment"
}
