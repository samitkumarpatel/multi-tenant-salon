output "cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "cluster_arn" {
  value = aws_ecs_cluster.this.arn
}

output "service_names" {
  value       = { for k, v in aws_ecs_service.this : k => v.name }
  description = "Map of service key → ECS service name"
}

output "alb_dns_name" {
  value = aws_lb.this.dns_name
}

output "alb_arn" {
  value = aws_lb.this.arn
}

output "alb_zone_id" {
  value = aws_lb.this.zone_id
}

output "alb_listener_arn" {
  value       = local.active_listener_arn
  description = "Primary ALB listener ARN — passed to the API Gateway module as the integration target"
}

output "task_execution_role_arns" {
  value       = { for k, v in aws_iam_role.task_execution : k => v.arn }
  description = "Map of service key → execution role ARN (used in github-oidc PassRole policy)"
}

output "task_role_arns" {
  value       = { for k, v in aws_iam_role.task : k => v.arn }
  description = "Map of service key → task role ARN"
}

output "log_group_names" {
  value       = { for k, v in aws_cloudwatch_log_group.this : k => v.name }
  description = "Map of service key → CloudWatch log group name"
}

output "task_definition_families" {
  value       = { for k, v in aws_ecs_task_definition.this : k => v.family }
  description = "Map of service key → task definition family name (used by CI to fetch and update the task def)"
}
