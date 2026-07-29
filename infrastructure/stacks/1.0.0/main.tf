locals {
  stack_version = "1.0.0"

  common_tags = {
    Project     = "multi-tenant-saloon"
    Environment = var.environment
    ManagedBy   = "terraform"
    Version     = local.stack_version
  }

  # One module.s3 instance per content bucket — for_each keeps them independently addressable.
  # See wiki/frontend-deployment.md for bucket → app mapping.
  content_buckets = {
    main-web        = "${var.name}-main-web"        # onboarding + admin (separate prefixes)
    public-web      = "${var.name}-public-web"       # per-saloon public website
    super-admin-web = "${var.name}-super-admin-web"  # super-admin dashboard
  }

  # Which CloudFront distribution's OAC is allowed to read each bucket.
  bucket_distribution_map = {
    main-web        = module.cloudfront.main_distribution_arn
    public-web      = module.cloudfront.wildcard_distribution_arn
    super-admin-web = module.cloudfront.wildcard_distribution_arn
  }
}

# ── S3 Content Buckets ────────────────────────────────────────────────────────

module "s3" {
  for_each = local.content_buckets
  source   = "../../modules/s3"

  name          = each.value
  force_destroy = var.environment == "dev"
  tags          = local.common_tags
}

# CloudFront access logs bucket — needs log-delivery ACL, not OAC.
resource "aws_s3_bucket" "cf_logs" {
  bucket        = "${var.name}-cf-logs"
  force_destroy = var.environment == "dev"
  tags          = merge(local.common_tags, { Name = "${var.name}-cf-logs" })
}

resource "aws_s3_bucket_ownership_controls" "cf_logs" {
  bucket = aws_s3_bucket.cf_logs.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "cf_logs" {
  bucket     = aws_s3_bucket.cf_logs.id
  acl        = "log-delivery-write"
  depends_on = [aws_s3_bucket_ownership_controls.cf_logs]
}

# ── CloudFront ────────────────────────────────────────────────────────────────
# Distribution #1: my-saloon.online  (onboarding + admin via CF Function routing)
# Distribution #2: *.my-saloon.online (public website + super-admin via Lambda@Edge)

module "cloudfront" {
  source = "../../modules/cloudfront"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name                      = "${var.name}-${var.environment}"
  domain                    = var.domain
  main_web_bucket_domain    = module.s3["main-web"].bucket_regional_domain
  public_web_bucket_domain  = module.s3["public-web"].bucket_regional_domain
  super_admin_bucket_domain = module.s3["super-admin-web"].bucket_regional_domain
  cf_logs_bucket            = aws_s3_bucket.cf_logs.id
  oac_main_web_id           = module.s3["main-web"].oac_id
  oac_public_web_id         = module.s3["public-web"].oac_id
  oac_super_admin_id        = module.s3["super-admin-web"].oac_id
  tags                      = local.common_tags
}

# ── S3 Bucket Policies (OAC) ──────────────────────────────────────────────────
# Kept here rather than inside the s3 module to avoid a circular dependency
# between module.s3 and module.cloudfront.

data "aws_iam_policy_document" "s3_oac" {
  for_each = local.bucket_distribution_map

  statement {
    sid    = "AllowCloudFrontOAC"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${module.s3[each.key].bucket_arn}/*"]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [each.value]
    }
  }
}

resource "aws_s3_bucket_policy" "s3_oac" {
  for_each = local.bucket_distribution_map
  bucket   = module.s3[each.key].bucket_id
  policy   = data.aws_iam_policy_document.s3_oac[each.key].json
}

# ── Route 53 ──────────────────────────────────────────────────────────────────
# apex (my-saloon.online), www, and wildcard (*.my-saloon.online) → CloudFront

module "route53" {
  source = "../../modules/route53"

  domain              = var.domain
  cf_main_domain      = module.cloudfront.main_distribution_domain
  cf_main_zone_id     = module.cloudfront.main_distribution_zone_id
  cf_wildcard_domain  = module.cloudfront.wildcard_distribution_domain
  cf_wildcard_zone_id = module.cloudfront.wildcard_distribution_zone_id
}
