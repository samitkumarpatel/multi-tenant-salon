output "cloudfront_main_id" {
  value       = module.cloudfront.main_distribution_id
  description = "Set as CF_MAIN_DIST_ID in GitHub Actions vars"
}

output "cloudfront_wildcard_id" {
  value       = module.cloudfront.wildcard_distribution_id
  description = "Set as CF_WILDCARD_DIST_ID in GitHub Actions vars"
}

output "s3_buckets" {
  value = { for k, v in module.s3 : k => v.bucket_id }
  description = "Map of bucket key → bucket name"
}
