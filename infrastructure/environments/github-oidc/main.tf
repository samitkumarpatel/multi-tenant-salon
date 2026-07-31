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
}

module "github_oidc" {
  source = "../../modules/github-oidc"

  name                         = "my-saloon"
  github_org                   = "samitkumarpatel"
  github_repo                  = "multi-tenant-saloon"
  s3_bucket_arns               = local.s3_bucket_arns
  cloudfront_distribution_arns = local.cloudfront_distribution_arns
  tags                         = local.common_tags
}
