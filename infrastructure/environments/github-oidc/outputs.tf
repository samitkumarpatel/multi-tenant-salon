output "github_actions_role_arn" {
  value       = module.github_oidc.github_actions_role_arn
  description = "Set as AWS_ROLE_ARN secret in GitHub repository settings"
}

output "oidc_provider_arn" {
  value       = module.github_oidc.oidc_provider_arn
  description = "ARN of the GitHub OIDC provider registered with this AWS account"
}
