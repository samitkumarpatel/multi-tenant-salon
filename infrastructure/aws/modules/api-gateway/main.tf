# ── VPC Link ──────────────────────────────────────────────────────────────────

resource "aws_apigatewayv2_vpc_link" "this" {
  name               = "${var.name}-vpc-link"
  security_group_ids = var.security_group_ids
  subnet_ids         = var.subnet_ids
  tags               = var.tags
}

# ── HTTP API (REST) ────────────────────────────────────────────────────────────

resource "aws_apigatewayv2_api" "http" {
  name          = "${var.name}-http"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = [
      "https://${var.domain}",     # apex  (onboarding / marketing)
      "https://www.${var.domain}", # www   (onboarding / marketing)
      "https://*.${var.domain}",   # all subdomains: admin, super-admin, tenant websites
    ]
    allow_methods  = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]
    allow_headers  = ["Content-Type", "Authorization", "X-Amz-Date", "X-Api-Key", "X-Requested-With"]
    expose_headers = ["Content-Type"]
    max_age        = 300
  }

  tags = var.tags
}

resource "aws_apigatewayv2_integration" "http" {
  api_id             = aws_apigatewayv2_api.http.id
  integration_type   = "HTTP_PROXY"
  integration_method = "ANY"
  integration_uri    = var.alb_listener_arn
  connection_type    = "VPC_LINK"
  connection_id      = aws_apigatewayv2_vpc_link.this.id
}

resource "aws_apigatewayv2_route" "http_default" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.http.id}"
}

resource "aws_apigatewayv2_stage" "http" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
  tags        = var.tags
}

resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = "api.${var.domain}"

  domain_name_configuration {
    certificate_arn = var.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }

  tags = var.tags
}

resource "aws_apigatewayv2_api_mapping" "http" {
  api_id      = aws_apigatewayv2_api.http.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.http.id
}

resource "aws_route53_record" "api" {
  zone_id = var.zone_id
  name    = "api.${var.domain}"
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

# ── WebSocket ──────────────────────────────────────────────────────────────────
# NOTE: API Gateway v2 WebSocket APIs do not support VPC Link integration.
# WebSocket support will be added when the Spring Boot app implements WS endpoints,
# using a public NLB or a separate integration approach.
