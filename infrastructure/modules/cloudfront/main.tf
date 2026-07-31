# ── Distribution #1: my-saloon.online ────────────────────────────────────────

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  aliases             = [var.domain, "www.${var.domain}", "admin.${var.domain}"]
  default_root_object = ""
  comment             = "${var.domain} — Distribution #1"
  price_class         = "PriceClass_100"

  origin {
    domain_name              = var.main_web_bucket_domain
    origin_id                = "s3-main-web"
    origin_access_control_id = var.oac_main_web_id
  }

  ordered_cache_behavior {
    path_pattern             = "/onboarding/*"
    target_origin_id         = "s3-main-web"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf" # CORS-S3Origin
  }

  ordered_cache_behavior {
    path_pattern             = "/admin/*"
    target_origin_id         = "s3-main-web"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf" # CORS-S3Origin
  }

  default_cache_behavior {
    target_origin_id         = "s3-main-web"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf" # CORS-S3Origin

    dynamic "function_association" {
      for_each = var.cf_function_arn != null ? [var.cf_function_arn] : []
      content {
        event_type   = "viewer-request"
        function_arn = function_association.value
      }
    }
  }

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
    acm_certificate_arn      = var.certificate_arn
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

# ── Distribution #2: *.my-saloon.online ──────────────────────────────────────

resource "aws_cloudfront_distribution" "wildcard" {
  enabled     = true
  aliases     = ["*.${var.domain}"]
  comment     = "*.${var.domain} — Distribution #2"
  price_class = "PriceClass_100"

  origin {
    domain_name              = var.public_web_bucket_domain
    origin_id                = "s3-public-web"
    origin_access_control_id = var.oac_public_web_id
  }

  origin {
    domain_name              = var.super_admin_bucket_domain
    origin_id                = "s3-super-admin"
    origin_access_control_id = var.oac_super_admin_id
  }

  default_cache_behavior {
    target_origin_id         = "s3-public-web"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf" # CORS-S3Origin

    dynamic "lambda_function_association" {
      for_each = var.lambda_edge_qualified_arn != null ? [var.lambda_edge_qualified_arn] : []
      content {
        event_type   = "origin-request"
        lambda_arn   = lambda_function_association.value
        include_body = false
      }
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
    acm_certificate_arn      = var.certificate_arn
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
