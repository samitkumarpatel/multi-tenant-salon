output "ghcr_credentials_secret_arn" {
  value = aws_secretsmanager_secret.ghcr_credentials.arn
}

output "rds_endpoint" {
  value     = module.rds.db_endpoint
  sensitive = true
}

output "ecs_cluster_name" {
  value = module.ecs.cluster_name
}

output "ecs_service_name" {
  value = module.ecs.service_name
}

output "alb_dns_name" {
  value = module.ecs.alb_dns_name
}

output "cloudfront_main_id" {
  value = module.cloudfront.main_distribution_id
}

output "cloudfront_wildcard_id" {
  value = module.cloudfront.wildcard_distribution_id
}

output "s3_main_web_bucket" {
  value = module.s3["main-web"].bucket_id
}

output "s3_public_web_bucket" {
  value = module.s3["public-web"].bucket_id
}

output "s3_super_admin_bucket" {
  value = module.s3["super-admin-web"].bucket_id
}
