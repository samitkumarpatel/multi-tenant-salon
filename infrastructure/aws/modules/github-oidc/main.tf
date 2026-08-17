# ── GitHub OIDC Provider (one per AWS account) ───────────────────────────────

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
  tags = var.tags
}

# ── Trust policy — only this repo can assume the role ────────────────────────

data "aws_iam_policy_document" "github_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_org}/${var.github_repo}:*"]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "${var.name}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
  tags               = var.tags
}

# ── Permissions — S3 deploy + CloudFront invalidation + ECS deploy ────────────

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "S3Objects"
    effect    = "Allow"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = [for arn in var.s3_bucket_arns : "${arn}/*"]
  }

  statement {
    sid       = "S3List"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = var.s3_bucket_arns
  }

  statement {
    sid       = "CloudFrontInvalidate"
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = var.cloudfront_distribution_arns
  }

  dynamic "statement" {
    for_each = length(var.ecs_cluster_arns) > 0 ? [1] : []
    content {
      sid    = "ECSDeployDescribe"
      effect = "Allow"
      actions = [
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:DescribeTasks",
        "ecs:ListTasks",
      ]
      resources = ["*"]
    }
  }

  dynamic "statement" {
    for_each = length(var.ecs_cluster_arns) > 0 ? [1] : []
    content {
      sid       = "ECSDeployUpdate"
      effect    = "Allow"
      actions   = ["ecs:UpdateService", "ecs:RegisterTaskDefinition"]
      resources = concat(
        var.ecs_cluster_arns,
        # task definition ARNs follow the same family name as the service
        ["arn:aws:ecs:*:*:task-definition/*"],
      )
    }
  }

  dynamic "statement" {
    for_each = length(var.ecs_task_execution_role_arns) > 0 ? [1] : []
    content {
      sid       = "ECSPassRole"
      effect    = "Allow"
      actions   = ["iam:PassRole"]
      resources = var.ecs_task_execution_role_arns
    }
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "deploy"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.deploy.json
}
