output "http_api_id" {
  value = aws_apigatewayv2_api.http.id
}

output "http_endpoint" {
  value       = aws_apigatewayv2_api.http.api_endpoint
  description = "Default API Gateway HTTP execute-api endpoint (for testing before custom domain)"
}

output "api_custom_domain" {
  value       = "api.${var.domain}"
  description = "Custom domain for the REST API"
}

output "vpc_link_id" {
  value = aws_apigatewayv2_vpc_link.this.id
}
