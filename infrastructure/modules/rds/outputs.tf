output "db_endpoint" {
  value = aws_db_instance.this.address
}

output "db_port" {
  value = aws_db_instance.this.port
}

output "secret_arn_db_url" {
  value = aws_secretsmanager_secret.db_url.arn
}

output "secret_arn_db_username" {
  value = aws_secretsmanager_secret.db_username.arn
}

output "secret_arn_db_password" {
  value = aws_secretsmanager_secret.db_password.arn
}

output "secret_path_prefix" {
  value = var.secret_path_prefix
}
