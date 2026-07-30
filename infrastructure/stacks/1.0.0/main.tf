locals {
  stack_version = "1.0.0"

  common_tags = {
    Project     = "multi-tenant-saloon"
    Environment = var.environment
    ManagedBy   = "terraform"
    Version     = local.stack_version
  }

  content_buckets = {
    main-web        = "${var.name}-main-web"        # onboarding + admin (separate prefixes)
    public-web      = "${var.name}-public-web"       # per-saloon public website
    super-admin-web = "${var.name}-super-admin-web"  # super-admin dashboard
  }

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

# ── CloudFront Function — Distribution #1 viewer-request routing ──────────────
# Routes between onboarding SPA and admin SPA by rewriting the S3 object key.
# Extend onboarding_paths when new top-level routes are added to saloon-onboarding.

resource "aws_cloudfront_function" "main_router" {
  name    = "${var.name}-main-router"
  runtime = "cloudfront-js-2.0"
  publish = true

  code = <<-JS
    function handler(event) {
      var request = event.request;
      var uri = request.uri;

      // admin.my-saloon.online → always serve the saloon-admin SPA (assets pass through)
      var host = request.headers.host ? request.headers.host.value : '';
      if (host === 'admin.${var.domain}') {
        if (!uri.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|json|map|webp|gif)$/)) {
          request.uri = '/admin/index.html';
        }
        return request;
      }

      // my-saloon.online / www. → route between onboarding and admin SPAs
      var onboardingPaths = ['/', '/login', '/signup', '/forgot-password', '/verify'];
      var isOnboarding = onboardingPaths.indexOf(uri) !== -1
        || uri.startsWith('/onboard')
        || uri.startsWith('/onboarding/');

      if (isOnboarding) {
        request.uri = '/onboarding/index.html';
        return request;
      }

      if (uri.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|json|map|webp|gif)$/)) {
        return request;
      }

      request.uri = '/admin/index.html';
      return request;
    }
  JS
}

# ── Lambda@Edge — Distribution #2 origin-request routing ─────────────────────
# Switches S3 origin based on Host header:
#   super-admin.<domain> → super-admin-web bucket
#   <slug>.<domain>      → public-web bucket (default)
# Must be deployed in us-east-1 (Lambda@Edge requirement).

data "aws_iam_policy_document" "lambda_edge_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com", "edgelambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_edge" {
  provider           = aws.us_east_1
  name               = "${var.name}-${var.environment}-cf-edge-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_edge_assume.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_edge_basic" {
  provider   = aws.us_east_1
  role       = aws_iam_role.lambda_edge.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "archive_file" "wildcard_router" {
  type        = "zip"
  output_path = "${path.module}/wildcard-router.zip"

  source {
    filename = "index.mjs"
    content  = <<-JS
      export const handler = async (event) => {
        const request = event.Records[0].cf.request;
        const host = (request.headers['host'] || [{}])[0].value || '';

        if (host === 'super-admin.${var.domain}') {
          request.origin.s3.domainName = '${module.s3["super-admin-web"].bucket_regional_domain}';
          request.origin.s3.path = '';
          request.headers['host'] = [{ key: 'Host', value: '${module.s3["super-admin-web"].bucket_regional_domain}' }];
        } else {
          request.origin.s3.domainName = '${module.s3["public-web"].bucket_regional_domain}';
          request.origin.s3.path = '';
          request.headers['host'] = [{ key: 'Host', value: '${module.s3["public-web"].bucket_regional_domain}' }];
        }

        if (!request.uri.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|json|map|webp|gif)$/)) {
          request.uri = '/index.html';
        }

        return request;
      };
    JS
  }
}

resource "aws_lambda_function" "wildcard_router" {
  provider         = aws.us_east_1
  filename         = data.archive_file.wildcard_router.output_path
  source_code_hash = data.archive_file.wildcard_router.output_base64sha256
  function_name    = "${var.name}-${var.environment}-wildcard-router"
  role             = aws_iam_role.lambda_edge.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  publish          = true
  tags             = local.common_tags

  depends_on = [aws_iam_role_policy_attachment.lambda_edge_basic]
}

# ── CloudFront ────────────────────────────────────────────────────────────────

module "cloudfront" {
  source = "../../modules/cloudfront"

  name                      = "${var.name}-${var.environment}"
  domain                    = var.domain
  certificate_arn           = var.certificate_arn
  main_web_bucket_domain    = module.s3["main-web"].bucket_regional_domain
  public_web_bucket_domain  = module.s3["public-web"].bucket_regional_domain
  super_admin_bucket_domain = module.s3["super-admin-web"].bucket_regional_domain
  cf_logs_bucket            = aws_s3_bucket.cf_logs.id
  oac_main_web_id           = module.s3["main-web"].oac_id
  oac_public_web_id         = module.s3["public-web"].oac_id
  oac_super_admin_id        = module.s3["super-admin-web"].oac_id
  cf_function_arn           = aws_cloudfront_function.main_router.arn
  lambda_edge_qualified_arn = aws_lambda_function.wildcard_router.qualified_arn
  tags                      = local.common_tags
}

# ── S3 Bucket Policies (OAC) ──────────────────────────────────────────────────

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

# ── Resource Group ────────────────────────────────────────────────────────────

resource "aws_resourcegroups_group" "env" {
  name        = "${var.name}-${var.environment}"
  description = "All resources for the ${var.environment} environment of ${var.name}"

  resource_query {
    query = jsonencode({
      ResourceTypeFilters = ["AWS::AllSupported"]
      TagFilters = [
        { Key = "Project", Values = ["multi-tenant-saloon"] },
        { Key = "Environment", Values = [var.environment] },
      ]
    })
  }

  tags = local.common_tags
}

# ── Route 53 ─────────────────────────────────────────────────────────────────

module "route53" {
  source = "../../modules/route53"

  domain              = var.domain
  zone_id             = var.zone_id
  cf_main_domain      = module.cloudfront.main_distribution_domain
  cf_main_zone_id     = module.cloudfront.main_distribution_zone_id
  cf_wildcard_domain  = module.cloudfront.wildcard_distribution_domain
  cf_wildcard_zone_id = module.cloudfront.wildcard_distribution_zone_id
}
