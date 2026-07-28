locals {
  common_tags = {
    Project     = "multi-tenant-saloon"
    Environment = var.environment
    ManagedBy   = "terraform"
    Stack       = "frontend"
  }

  # Stable keys used to address each bucket instance throughout this stack.
  frontend_buckets = {
    main-web        = "${var.name}-main-web"
    public-web      = "${var.name}-public-web"
    super-admin-web = "${var.name}-super-admin-web"
  }

  # Maps each content bucket to the CloudFront distribution that serves it.
  bucket_policy_map = {
    main-web        = module.cloudfront.main_distribution_arn
    public-web      = module.cloudfront.wildcard_distribution_arn
    super-admin-web = module.cloudfront.wildcard_distribution_arn
  }
}

# ── S3 Content Buckets ────────────────────────────────────────────────────────

module "s3" {
  for_each = local.frontend_buckets
  source   = "../../modules/s3"

  name          = each.value
  force_destroy = var.environment == "dev"
  tags          = local.common_tags
}

# CloudFront access logs — different config (log-delivery ACL, no OAC).
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

# ── CloudFront ─────────────────────────────────────────────────────────────────

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
# Kept here — not inside the s3 module — so they can reference both
# module.s3[*] and module.cloudfront without a circular dependency.

data "aws_iam_policy_document" "s3_oac" {
  for_each = local.bucket_policy_map

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
  for_each = local.bucket_policy_map
  bucket   = module.s3[each.key].bucket_id
  policy   = data.aws_iam_policy_document.s3_oac[each.key].json
}

# ── Route 53 — CloudFront DNS records ─────────────────────────────────────────

data "aws_route53_zone" "this" {
  name         = var.domain
  private_zone = false
}

resource "aws_route53_record" "apex" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = var.domain
  type    = "A"
  alias {
    name                   = module.cloudfront.main_distribution_domain
    zone_id                = module.cloudfront.main_distribution_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "www" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = "www.${var.domain}"
  type    = "A"
  alias {
    name                   = module.cloudfront.main_distribution_domain
    zone_id                = module.cloudfront.main_distribution_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "wildcard" {
  zone_id = data.aws_route53_zone.this.zone_id
  name    = "*.${var.domain}"
  type    = "A"
  alias {
    name                   = module.cloudfront.wildcard_distribution_domain
    zone_id                = module.cloudfront.wildcard_distribution_zone_id
    evaluate_target_health = false
  }
}
