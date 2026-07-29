module "github_oidc" {
  source = "../../stacks/github-oidc"

  name        = var.name
  aws_region  = var.aws_region
  github_org  = var.github_org
  github_repo = var.github_repo
}
