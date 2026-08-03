resource "aws_cloudfront_distribution" "this" {
  for_each = var.distributions

  enabled     = true
  aliases     = each.value.aliases
  price_class = "PriceClass_100"
  comment     = "${var.name} — ${each.key}"

  dynamic "origin" {
    for_each = each.value.origins
    content {
      domain_name              = origin.value.domain_name
      origin_id                = origin.key
      origin_access_control_id = origin.value.oac_id
    }
  }

  dynamic "ordered_cache_behavior" {
    for_each = each.value.path_behaviors
    content {
      path_pattern             = ordered_cache_behavior.value.path_pattern
      target_origin_id         = ordered_cache_behavior.value.origin_key
      viewer_protocol_policy   = "redirect-to-https"
      allowed_methods          = ["GET", "HEAD", "OPTIONS"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = true
      cache_policy_id          = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
      origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf" # CORS-S3Origin
    }
  }

  default_cache_behavior {
    target_origin_id         = each.value.default_origin_key
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
    origin_request_policy_id = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf" # CORS-S3Origin

    dynamic "function_association" {
      for_each = each.value.cf_function_arn != null ? [each.value.cf_function_arn] : []
      content {
        event_type   = "viewer-request"
        function_arn = function_association.value
      }
    }

    dynamic "lambda_function_association" {
      for_each = each.value.lambda_edge_qualified_arn != null ? [each.value.lambda_edge_qualified_arn] : []
      content {
        event_type   = "origin-request"
        lambda_arn   = lambda_function_association.value
        include_body = false
      }
    }
  }

  dynamic "custom_error_response" {
    for_each = each.value.custom_error_responses
    content {
      error_code            = custom_error_response.value.error_code
      response_code         = custom_error_response.value.response_code
      response_page_path    = custom_error_response.value.response_page_path
      error_caching_min_ttl = 0
    }
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = each.value.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  logging_config {
    include_cookies = false
    bucket          = "${var.cf_logs_bucket}.s3.amazonaws.com"
    prefix          = each.value.log_prefix
  }

  tags = var.tags
}
