output "name_servers" {
  value       = module.dns_bootstrapping.name_servers
  description = "Set these NS records at your domain registrar after Phase 1"
}

# ── Frontend ──────────────────────────────────────────────────────────────────

# Named convenience outputs — set each as the matching GitHub Actions variable
output "cloudfront_onboarding_id" {
  value       = module.frontend.cloudfront_distribution_ids["onboarding"]
  description = "Set as CF_DISTRIBUTION_ONBOARDING in GitHub Actions repository variables"
}

output "cloudfront_admin_id" {
  value       = module.frontend.cloudfront_distribution_ids["admin"]
  description = "Set as CF_DISTRIBUTION_ADMIN in GitHub Actions repository variables"
}

output "cloudfront_public_id" {
  value       = module.frontend.cloudfront_distribution_ids["wildcard"]
  description = "Set as CF_DISTRIBUTION_PUBLIC in GitHub Actions repository variables"
}

output "cloudfront_super_admin_id" {
  value       = module.frontend.cloudfront_distribution_ids["super-admin"]
  description = "Set as CF_DISTRIBUTION_SUPER_ADMIN in GitHub Actions repository variables"
}

# Full map — useful when distributions change
output "cloudfront_distribution_ids" {
  value       = module.frontend.cloudfront_distribution_ids
  description = "Map of distribution key → CloudFront distribution ID"
}

output "s3_buckets" {
  value       = module.frontend.s3_buckets
  description = "Map of bucket key → bucket name"
}

output "cf_logs_bucket" {
  value       = module.frontend.cf_logs_bucket
  description = "CloudFront access logs bucket name"
}

output "resource_group_arn" {
  value       = module.frontend.resource_group_arn
  description = "ARN of the AWS Resource Group for this environment"
}

# ── Backend ───────────────────────────────────────────────────────────────────

output "api_endpoint" {
  value       = module.backend.api_endpoint
  description = "REST API endpoint — set as API_BASE_URL in the frontend apps"
}

output "ecs_cluster_name" {
  value       = module.backend.ecs_cluster_name
  description = "Set as ECS_CLUSTER in GitHub Actions repository variables"
}

output "ecs_service_names" {
  value       = module.backend.ecs_service_names
  description = "Map of service key → ECS service name"
}

output "rds_secret_path_prefix" {
  value       = module.backend.rds_secret_path_prefix
  description = "Secrets Manager path prefix for the database credentials"
}

output "ghcr_secret_name" {
  value       = module.backend.ghcr_secret_name
  description = "Populate this Secrets Manager secret with GitHub registry pull credentials before first ECS deploy"
}

output "ecs_task_definition_families" {
  value       = module.backend.ecs_task_definition_families
  description = "Map of service key → ECS task definition family name (set each as ECS_TASK_FAMILY_<KEY> in GitHub Actions)"
}
