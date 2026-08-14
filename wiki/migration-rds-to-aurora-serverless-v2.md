# Migration: RDS PostgreSQL → Aurora Serverless v2

## Why

RDS `db.t4g.micro` runs 24/7 at ~$15/month regardless of usage. Aurora Serverless v2 with auto-pause costs ~$5–7/month for an 8hr/day dev workload and scales to zero when idle.

No application code changes are required — Aurora PostgreSQL uses the same wire protocol, JDBC driver, and SQL dialect.

## Compatibility

| | Current (RDS) | Target (Aurora Serverless v2) |
|---|---|---|
| Engine | PostgreSQL 17 | Aurora PostgreSQL 16 |
| JDBC URL format | Same | Same |
| Schema / DDL | Unchanged | Unchanged |
| Flyway migrations | Unchanged | Unchanged |
| Spring Data JDBC | Unchanged | Unchanged |
| HikariCP pooling | Unchanged | Unchanged |

The only difference is Aurora PostgreSQL currently tops out at version 16 (vs 17 on RDS). The codebase uses no PostgreSQL-17-specific features so this is a non-issue.

## What Changes

### Terraform (`infrastructure/modules/rds/main.tf`)

Replace `aws_db_instance` with an Aurora cluster + instance:

```hcl
resource "aws_rds_cluster" "this" {
  cluster_identifier      = "${var.name}-postgres"
  engine                  = "aurora-postgresql"
  engine_mode             = "provisioned"
  engine_version          = "16.6"
  database_name           = var.db_name
  master_username         = var.db_username
  master_password         = random_password.db.result
  db_subnet_group_name    = aws_db_subnet_group.this.name
  vpc_security_group_ids  = [var.security_group_id]
  storage_encrypted       = true
  skip_final_snapshot     = var.dev_mode
  final_snapshot_identifier = var.dev_mode ? null : "${var.name}-final-snapshot"
  deletion_protection     = var.dev_mode ? false : true
  backup_retention_period = var.dev_mode ? 1 : 7

  serverlessv2_scaling_configuration {
    min_capacity             = var.dev_mode ? 0 : 0.5   # 0 = auto-pause in dev
    max_capacity             = var.dev_mode ? 4 : 16
    seconds_until_auto_pause = var.dev_mode ? 300 : null # pause after 5 min idle
  }

  tags = merge(var.tags, { Name = "${var.name}-postgres" })
}

resource "aws_rds_cluster_instance" "this" {
  identifier          = "${var.name}-postgres"
  cluster_identifier  = aws_rds_cluster.this.id
  instance_class      = "db.serverless"
  engine              = aws_rds_cluster.this.engine
  engine_version      = aws_rds_cluster.this.engine_version
  db_subnet_group_name = aws_db_subnet_group.this.name

  tags = merge(var.tags, { Name = "${var.name}-postgres" })
}
```

Update the `db_url` secret to use the cluster endpoint:

```hcl
resource "aws_secretsmanager_secret_version" "db_url" {
  secret_id     = aws_secretsmanager_secret.db_url.id
  secret_string = "jdbc:postgresql://${aws_rds_cluster.this.endpoint}:5432/${var.db_name}?sslmode=require"
}
```

Remove the old `aws_db_instance` resource and the `aws_secretsmanager_secret_version.db_url` that references it.

### No application changes

`application.yaml`, `application-prod.yaml`, Flyway config, and all Java code stay exactly as-is. The new connection string is written to the same Secrets Manager path (`/my-salon/dev/db-url`), so ECS picks it up automatically on next task start.

## Data Migration Steps

1. **Take a final snapshot** of the existing RDS instance before destroying it
2. **Apply Terraform** — this creates the Aurora cluster fresh
3. **Let Flyway run** on first ECS deploy — it will apply all migrations to the new empty DB
4. **Restore data** (if needed for dev, skip if starting fresh is acceptable):
   ```bash
   # Dump from old RDS
   pg_dump -h <old-rds-endpoint> -U salon_app -d salon -F c -f salon_backup.dump

   # Restore to Aurora
   pg_restore -h <aurora-endpoint> -U salon_app -d salon salon_backup.dump
   ```

For dev, starting fresh (letting Flyway recreate the schema) is usually acceptable — no production data to preserve.

## Cost Comparison

| | RDS db.t4g.micro | Aurora Serverless v2 |
|---|---|---|
| Idle (nights/weekends) | ~$15/mo (always on) | ~$0 (auto-paused) |
| Active 8hr/day | ~$15/mo | ~$5–7/mo |
| Active 24/7 | ~$15/mo | ~$10–15/mo |

## Gotchas

- **First connection after auto-pause** takes 20–30 seconds to resume. Configure HikariCP `connectionTimeout` to at least 60s in dev:
  ```yaml
  spring:
    datasource:
      hikari:
        connection-timeout: 60000   # 60s — covers Aurora resume time
  ```
- **`seconds_until_auto_pause`** requires `min_capacity = 0`. Only available in dev mode.
- Aurora Serverless v2 **does not support** `db.t4g.*` instance classes — use `db.serverless` instead.
- Minimum billable ACU when active is **0.5 ACU** (~$0.06/hr), even if `min_capacity = 0`.
