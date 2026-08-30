resource "random_password" "db" {
  length  = 24
  special = false
}

resource "aws_secretsmanager_secret" "db_url" {
  name                    = "/${var.secret_path_prefix}/db-url"
  recovery_window_in_days = var.dev_mode ? 0 : 7
  tags                    = var.tags
}

resource "aws_secretsmanager_secret" "db_username" {
  name                    = "/${var.secret_path_prefix}/db-username"
  recovery_window_in_days = var.dev_mode ? 0 : 7
  tags                    = var.tags
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "/${var.secret_path_prefix}/db-password"
  recovery_window_in_days = var.dev_mode ? 0 : 7
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "db_username" {
  secret_id     = aws_secretsmanager_secret.db_username.id
  secret_string = var.db_username
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-db-subnet-group"
  subnet_ids = var.subnet_ids
  tags       = merge(var.tags, { Name = "${var.name}-db-subnet-group" })
}

resource "aws_db_instance" "this" {
  identifier = "${var.name}-postgres"

  engine         = "postgres"
  engine_version = "17"
  instance_class = var.dev_mode ? "db.t4g.micro" : "db.t4g.small"

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.security_group_id]

  multi_az                  = var.dev_mode ? false : true
  publicly_accessible       = var.dev_mode
  deletion_protection       = var.dev_mode ? false : true
  skip_final_snapshot       = var.dev_mode ? true : false
  final_snapshot_identifier = var.dev_mode ? null : "${var.name}-final-snapshot"

  backup_retention_period = var.dev_mode ? 1 : 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  apply_immediately = var.dev_mode

  tags = merge(var.tags, { Name = "${var.name}-postgres" })
}

resource "aws_secretsmanager_secret_version" "db_url" {
  secret_id     = aws_secretsmanager_secret.db_url.id
  secret_string = "jdbc:postgresql://${aws_db_instance.this.address}:5432/${var.db_name}?sslmode=require"
}
