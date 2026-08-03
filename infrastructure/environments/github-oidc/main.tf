data "aws_caller_identity" "current" {}

locals {
  common_tags = {
    Project   = "multi-tenant-saloon"
    ManagedBy = "terraform"
  }

  s3_bucket_arns = [
    "arn:aws:s3:::my-saloon-main-web",
    "arn:aws:s3:::my-saloon-public-web",
    "arn:aws:s3:::my-saloon-super-admin-web",
  ]

  cloudfront_distribution_arns = [
    "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/*",
  ]

  # ECS resources — naming convention: <name>-<environment>-<service-key>
  # Cluster ARN + one service ARN per service key defined in environments/dev/main.tf.
  # Add a new entry here whenever a new service key is added to module.backend.services.
  ecs_cluster_arns = [
    "arn:aws:ecs:*:${data.aws_caller_identity.current.account_id}:cluster/my-saloon-dev-cluster",
    "arn:aws:ecs:*:${data.aws_caller_identity.current.account_id}:service/my-saloon-dev-cluster/my-saloon-dev-api",
  ]

  ecs_task_execution_role_arns = [
    "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/my-saloon-dev-api-exec-role",
    "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/my-saloon-dev-api-task-role",
  ]
}

module "github_oidc" {
  source = "../../modules/github-oidc"

  name                         = "my-saloon"
  github_org                   = "samitkumarpatel"
  github_repo                  = "multi-tenant-saloon"
  s3_bucket_arns               = local.s3_bucket_arns
  cloudfront_distribution_arns = local.cloudfront_distribution_arns
  ecs_cluster_arns             = local.ecs_cluster_arns
  ecs_task_execution_role_arns = local.ecs_task_execution_role_arns
  tags                         = local.common_tags
}
