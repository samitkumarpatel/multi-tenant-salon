# ── CloudFront Function: main-router (Distribution #1) ───────────────────────
# Viewer-request stage: rewrites URI for onboarding vs admin routing.

resource "aws_cloudfront_function" "main_router" {
  name    = "main-router-fn"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      var uri = request.uri;

      var onboardingPaths = ['/', '/login', '/signup', '/forgot-password', '/verify'];
      var isOnboarding = onboardingPaths.indexOf(uri) !== -1
        || uri.startsWith('/onboard')
        || uri.startsWith('/onboarding/');

      if (isOnboarding) {
        request.uri = '/onboarding/index.html';
        return request;
      }

      // Static assets already have correct /admin/ or /onboarding/ prefix from vite base
      if (uri.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|json|map|webp|gif)$/)) {
        return request;
      }

      // Everything else is a saloon-admin route (e.g. /<saloon-id>/*)
      request.uri = '/admin/index.html';
      return request;
    }
  JS
}

# ── Lambda@Edge: wildcard-origin-router (Distribution #2) ────────────────────
# Origin-request stage: switches S3 origin based on Host header.
# Must be deployed in us-east-1.

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
  name               = "${var.name}-cf-edge-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_edge_assume.json
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

        if (host === 'admin.${var.domain}') {
          request.origin.s3.domainName = '${var.super_admin_bucket_domain}';
          request.origin.s3.path = '';
          request.headers['host'] = [{ key: 'Host', value: '${var.super_admin_bucket_domain}' }];
        } else {
          request.origin.s3.domainName = '${var.public_web_bucket_domain}';
          request.origin.s3.path = '';
          request.headers['host'] = [{ key: 'Host', value: '${var.public_web_bucket_domain}' }];
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
  function_name    = "${var.name}-wildcard-router"
  role             = aws_iam_role.lambda_edge.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  publish          = true

  depends_on = [aws_iam_role_policy_attachment.lambda_edge_basic]
}

# ── ACM Certificate (us-east-1) ───────────────────────────────────────────────

data "aws_acm_certificate" "this" {
  provider    = aws.us_east_1
  domain      = var.domain
  types       = ["AMAZON_ISSUED"]
  most_recent = true
  statuses    = ["ISSUED"]
}

# ── Distribution #1: my-saloon.online (onboarding + admin on shared domain) ──

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  aliases             = [var.domain, "www.${var.domain}"]
  default_root_object = ""
  comment             = "${var.domain} — onboarding + admin"
  price_class         = "PriceClass_100"

  origin {
    domain_name              = var.main_web_bucket_domain
    origin_id                = "s3-main-web"
    origin_access_control_id = var.oac_main_web_id
  }

  # Static asset paths pass through to S3 without CF function rewrite.
  # These must be declared before the default behavior (lower path_pattern = higher priority).
  ordered_cache_behavior {
    path_pattern           = "/onboarding/*"
    target_origin_id       = "s3-main-web"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf" # CORS-S3Origin
  }

  ordered_cache_behavior {
    path_pattern           = "/admin/*"
    target_origin_id       = "s3-main-web"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf" # CORS-S3Origin
  }

  default_cache_behavior {
    target_origin_id       = "s3-main-web"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
    origin_request_policy_id   = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf" # CORS-S3Origin

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.main_router.arn
    }
  }

  # S3 returns 403 for missing keys (private bucket). Serve SPA shell so
  # deep-linked routes render correctly; the SPA handles 404 internally.
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/onboarding/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/onboarding/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = data.aws_acm_certificate.this.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  logging_config {
    include_cookies = false
    bucket          = "${var.cf_logs_bucket}.s3.amazonaws.com"
    prefix          = "main/"
  }

  tags = var.tags
}

# ── Distribution #2: *.my-saloon.online (public sites + super-admin) ─────────

resource "aws_cloudfront_distribution" "wildcard" {
  enabled     = true
  aliases     = ["*.${var.domain}"]
  comment     = "*.${var.domain} — public saloon sites + super-admin"
  price_class = "PriceClass_100"

  # Default origin: public-web (saloon public sites)
  origin {
    domain_name              = var.public_web_bucket_domain
    origin_id                = "s3-public-web"
    origin_access_control_id = var.oac_public_web_id
  }

  # Secondary origin: super-admin-web
  origin {
    domain_name              = var.super_admin_bucket_domain
    origin_id                = "s3-super-admin"
    origin_access_control_id = var.oac_super_admin_id
  }

  default_cache_behavior {
    target_origin_id       = "s3-public-web"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf" # CORS-S3Origin

    lambda_function_association {
      event_type   = "origin-request"
      lambda_arn   = aws_lambda_function.wildcard_router.qualified_arn
      include_body = false
    }
  }

  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = data.aws_acm_certificate.this.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  logging_config {
    include_cookies = false
    bucket          = "${var.cf_logs_bucket}.s3.amazonaws.com"
    prefix          = "wildcard/"
  }

  tags = var.tags
}
