output "role_arn" {
  value       = aws_iam_role.github_actions.arn
  description = "Set as AWS_ROLE_ARN secret in GitHub repository settings."
}

output "oidc_provider_arn" {
  value       = aws_iam_openid_connect_provider.github.arn
  description = "ARN of the GitHub OIDC provider registered with this AWS account."
}
