data "aws_caller_identity" "current" {}

locals {
  common_tags = {
    Project   = "multi-tenant-saloon"
    ManagedBy = "terraform"
  }

  # Covers all environment buckets: my-saloon-main-web, my-saloon-public-web, etc.
  s3_bucket_arns = [
    "arn:aws:s3:::${var.name}-main-web",
    "arn:aws:s3:::${var.name}-public-web",
    "arn:aws:s3:::${var.name}-super-admin-web",
  ]

  # Scoped to this account; covers all distributions across all environments.
  cloudfront_distribution_arns = [
    "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/*",
  ]
}

module "github_oidc" {
  source = "../../modules/github-oidc"

  name                         = var.name
  github_org                   = var.github_org
  github_repo                  = var.github_repo
  s3_bucket_arns               = local.s3_bucket_arns
  cloudfront_distribution_arns = local.cloudfront_distribution_arns
  tags                         = local.common_tags
}
