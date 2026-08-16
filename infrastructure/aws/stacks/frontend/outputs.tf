output "cloudfront_distribution_ids" {
  value       = module.cloudfront.distribution_ids
  description = "Map of distribution key → CloudFront distribution ID"
}

output "cloudfront_distribution_arns" {
  value       = module.cloudfront.distribution_arns
  description = "Map of distribution key → CloudFront distribution ARN"
}

output "s3_buckets" {
  value       = { for k, v in module.s3 : k => v.bucket_id }
  description = "Map of bucket key → bucket name"
}

output "cf_logs_bucket" {
  value       = aws_s3_bucket.cf_logs.id
  description = "CloudFront access logs bucket name"
}

output "resource_group_arn" {
  value       = aws_resourcegroups_group.env.arn
  description = "ARN of the AWS Resource Group for this environment"
}
