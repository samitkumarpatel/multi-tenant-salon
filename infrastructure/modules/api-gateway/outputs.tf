output "http_api_id" {
  value = aws_apigatewayv2_api.http.id
}

output "ws_api_id" {
  value = aws_apigatewayv2_api.ws.id
}

output "http_endpoint" {
  value       = aws_apigatewayv2_api.http.api_endpoint
  description = "Default API Gateway HTTP execute-api endpoint (for testing before custom domain)"
}

output "ws_endpoint" {
  value       = "${aws_apigatewayv2_api.ws.api_endpoint}/prod"
  description = "Default API Gateway WebSocket endpoint (for testing before custom domain)"
}

output "api_custom_domain" {
  value       = "api.${var.domain}"
  description = "Custom domain for the REST API"
}

output "ws_custom_domain" {
  value       = "ws.${var.domain}"
  description = "Custom domain for the WebSocket API"
}

output "vpc_link_id" {
  value = aws_apigatewayv2_vpc_link.this.id
}
