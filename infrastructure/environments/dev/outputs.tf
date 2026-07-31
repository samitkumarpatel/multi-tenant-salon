output "name_servers" {
  value       = module.dns_bootstrapping.name_servers
  description = "Set these NS records at your domain registrar after Phase 1"
}

output "cloudfront_main_id" {
  value       = module.stack.cloudfront_main_id
  description = "Set as CF_MAIN_DIST_ID in GitHub Actions repository variables"
}

output "cloudfront_wildcard_id" {
  value       = module.stack.cloudfront_wildcard_id
  description = "Set as CF_WILDCARD_DIST_ID in GitHub Actions repository variables"
}

output "s3_buckets" {
  value       = module.stack.s3_buckets
  description = "Map of bucket key → bucket name (main-web, public-web, super-admin-web)"
}

output "cf_logs_bucket" {
  value       = module.stack.cf_logs_bucket
  description = "CloudFront access logs bucket name"
}

output "resource_group_arn" {
  value       = module.stack.resource_group_arn
  description = "ARN of the AWS Resource Group for this environment"
}
