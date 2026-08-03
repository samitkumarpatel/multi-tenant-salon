output "vpc_id" {
  value       = data.aws_vpc.default.id
  description = "Default VPC ID used by the backend"
}

output "api_endpoint" {
  value       = "https://${module.api_gateway.api_custom_domain}"
  description = "REST API endpoint — set as API_BASE_URL in the frontend apps"
}

output "ecs_cluster_name" {
  value       = module.ecs.cluster_name
  description = "Set as ECS_CLUSTER in GitHub Actions repository variables"
}

output "ecs_service_names" {
  value       = module.ecs.service_names
  description = "Map of service key → ECS service name. Set each as ECS_SERVICE_<KEY> in GitHub Actions."
}

output "task_execution_role_arns" {
  value       = module.ecs.task_execution_role_arns
  description = "Map of service key → execution role ARN"
}

output "task_role_arns" {
  value       = module.ecs.task_role_arns
  description = "Map of service key → task role ARN"
}

output "rds_secret_path_prefix" {
  value       = module.rds.secret_path_prefix
  description = "Secrets Manager path prefix for the database credentials"
}

output "ghcr_secret_name" {
  value       = aws_secretsmanager_secret.ghcr.name
  description = "Populate with GitHub registry credentials before first ECS deploy: {\"username\":\"<user>\",\"password\":\"<PAT>\"}"
}

output "ecs_task_definition_families" {
  value       = module.ecs.task_definition_families
  description = "Map of service key → ECS task definition family name (use as ECS_TASK_FAMILY in GitHub Actions)"
}
