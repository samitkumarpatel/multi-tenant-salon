locals {
  common_tags = {
    Project     = "multi-tenant-salon"
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  # Build the distributions input for module.cloudfront by merging the
  # environment config with the computed bucket origins and function ARNs.
  cf_distributions = {
    for dist_key, dist in var.distributions : dist_key => {
      aliases            = dist.aliases
      certificate_arn    = var.certificate_arns[dist.certificate_key]
      default_origin_key = dist.default_origin_key
      log_prefix         = dist.log_prefix
      path_behaviors     = dist.path_behaviors
      custom_error_responses = dist.custom_error_responses

      origins = {
        for origin_key in distinct(concat([dist.default_origin_key], dist.extra_origins)) :
        origin_key => {
          domain_name = module.s3[origin_key].bucket_regional_domain
          oac_id      = module.s3[origin_key].oac_id
        }
      }

      cf_function_arn           = null
      lambda_edge_qualified_arn = null
    }
  }

  # For OAC bucket policies: derive which distribution ARNs are allowed per bucket
  bucket_distribution_arns = {
    for bucket_key in keys(var.buckets) : bucket_key => [
      for dist_key, dist in var.distributions :
      module.cloudfront.distribution_arns[dist_key]
      if dist.default_origin_key == bucket_key || contains(dist.extra_origins, bucket_key)
    ]
  }

  # Build Route 53 records from the dns_records map
  r53_records = {
    for rec_key, rec in var.dns_records : rec_key => {
      name       = rec.subdomain == "" ? var.domain : "${rec.subdomain}.${var.domain}"
      cf_domain  = module.cloudfront.distribution_domains[rec.distribution_key]
      cf_zone_id = module.cloudfront.distribution_zone_ids[rec.distribution_key]
    }
  }
}

# ── S3 Content Buckets ────────────────────────────────────────────────────────

module "s3" {
  for_each = var.buckets
  source   = "../../modules/s3"

  name          = "${var.name}-${each.key}"
  force_destroy = each.value.force_destroy
  cors_rules    = each.value.cors_rules
  tags          = local.common_tags
}

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

# ── CloudFront Distributions ──────────────────────────────────────────────────

module "cloudfront" {
  source = "../../modules/cloudfront"

  name           = "${var.name}-${var.environment}"
  cf_logs_bucket = aws_s3_bucket.cf_logs.id
  distributions  = local.cf_distributions
  tags           = local.common_tags
}

# ── S3 Bucket Policies (OAC) ──────────────────────────────────────────────────
# Each bucket allows read access from every CloudFront distribution that
# lists it as an origin.

data "aws_iam_policy_document" "s3_oac" {
  for_each = var.buckets

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
      values   = local.bucket_distribution_arns[each.key]
    }
  }
}

resource "aws_s3_bucket_policy" "s3_oac" {
  for_each = var.buckets
  bucket   = module.s3[each.key].bucket_id
  policy   = data.aws_iam_policy_document.s3_oac[each.key].json
}

# ── Resource Group ────────────────────────────────────────────────────────────

resource "aws_resourcegroups_group" "env" {
  name        = "${var.name}-${var.environment}"
  description = "All resources for the ${var.environment} environment of ${var.name}"

  resource_query {
    query = jsonencode({
      ResourceTypeFilters = ["AWS::AllSupported"]
      TagFilters = [
        { Key = "Project", Values = ["multi-tenant-salon"] },
        { Key = "Environment", Values = [var.environment] },
      ]
    })
  }

  tags = local.common_tags
}

# ── Route 53 ──────────────────────────────────────────────────────────────────

module "route53" {
  source = "../../modules/route53"

  zone_id = var.zone_id
  records = local.r53_records
}
