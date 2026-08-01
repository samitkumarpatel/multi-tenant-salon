# Backend Deployment Plan — ECS Fargate + RDS

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Java 25, Spring Boot 4.1.0, GraalVM native image |
| Container registry | Amazon ECR |
| Compute | ECS Fargate (70% Spot + 30% On-demand) |
| Load balancer | Application Load Balancer (HTTPS :443) |
| Database | Amazon RDS PostgreSQL (Multi-AZ for production) |
| Secrets | AWS Secrets Manager |
| DNS | Route 53 → ALB |

---

## Architecture Overview

```
                        Route 53
                   api.my-saloon.online
                          │
                          ▼
              ┌─────────────────────┐
              │  Application Load   │
              │  Balancer (HTTPS)   │
              │  :443 → :8080       │
              └─────────┬───────────┘
                        │
              ┌─────────▼───────────┐
              │   ECS Service       │
              │   (saloon-backend)  │
              │                     │
              │  70% Fargate Spot   │
              │  30% Fargate        │
              │                     │
              │  min: 1 task        │
              │  max: 5 tasks       │
              └─────────┬───────────┘
                        │
              ┌─────────▼───────────┐
              │   RDS PostgreSQL    │
              │   (private subnet)  │
              │   Multi-AZ          │
              └─────────────────────┘
```

All ECS tasks and RDS run in **private subnets**. Only the ALB is in public subnets.

---

## AWS Resources

### VPC & Networking

Use the default VPC or create a dedicated one:

- **Public subnets** (2 AZs) — ALB only
- **Private subnets** (2 AZs) — ECS tasks + RDS
- **NAT Gateway** — allows tasks to pull ECR images and reach AWS services

### ECR Repository

```
my-saloon-backend   ← container images tagged by git SHA
```

Enable image scan on push and lifecycle policy to retain the last 10 images.

### RDS PostgreSQL

| Setting | Value |
|---------|-------|
| Engine | PostgreSQL 17 |
| Instance class | `db.t4g.small` (upgrade to `db.t4g.medium` when load justifies) |
| Storage | 20 GB gp3, autoscaling to 100 GB |
| Multi-AZ | Yes (production) / No (staging) |
| Backup retention | 7 days |
| Database name | `saloon` |
| Port | 5432 |

Store the DB connection string in **AWS Secrets Manager** (not environment variables):

```
/multi-tenant-saloon/prod/db-url
  → jdbc:postgresql://<rds-host>:5432/saloon?sslmode=require
/multi-tenant-saloon/prod/db-username
  → saloon_app
/multi-tenant-saloon/prod/db-password
  → <generated>
```

### ECS Cluster & Service

**Cluster:** `my-saloon-cluster`

**Task Definition:**

```json
{
  "family": "saloon-backend",
  "cpu": "512",
  "memory": "1024",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "containerDefinitions": [
    {
      "name": "saloon-backend",
      "image": "<account>.dkr.ecr.ap-south-1.amazonaws.com/my-saloon-backend:<sha>",
      "portMappings": [{ "containerPort": 8080, "protocol": "tcp" }],
      "environment": [
        { "name": "SPRING_PROFILES_ACTIVE", "value": "prod" }
      ],
      "secrets": [
        { "name": "SPRING_DATASOURCE_URL",      "valueFrom": "/multi-tenant-saloon/prod/db-url" },
        { "name": "SPRING_DATASOURCE_USERNAME",  "valueFrom": "/multi-tenant-saloon/prod/db-username" },
        { "name": "SPRING_DATASOURCE_PASSWORD",  "valueFrom": "/multi-tenant-saloon/prod/db-password" }
      ],
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8080/actuator/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 10
      },
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/saloon-backend",
          "awslogs-region": "ap-south-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

**Service:**

```
Capacity provider strategy:
  - FARGATE_SPOT  weight=7
  - FARGATE       weight=3

Desired count: 1
Min healthy percent: 100
Max percent: 200

Auto-scaling:
  Target tracking — CPU utilization 60%
  Scale-out cooldown: 60s
  Scale-in cooldown: 300s
  Min tasks: 1 / Max tasks: 5
```

**GraalVM native image** cold starts are ~100–200 ms, so Spot interruptions (new task start) are low-impact.

### Application Load Balancer

- **Listener:** HTTPS :443, ACM certificate for `api.my-saloon.online`
- **HTTP :80:** redirect to HTTPS
- **Target group:** port 8080, health check `GET /actuator/health` → 200

### Spring Boot `application-prod.yaml`

The production profile overrides only what differs from defaults:

```yaml
spring:
  datasource:
    url: ${SPRING_DATASOURCE_URL}
    username: ${SPRING_DATASOURCE_USERNAME}
    password: ${SPRING_DATASOURCE_PASSWORD}
  sql:
    init:
      mode: always   # V1__schema.sql runs on startup; idempotent DDL (CREATE TABLE IF NOT EXISTS)
  jpa:
    open-in-view: false
management:
  endpoints:
    web:
      exposure:
        include: health,info
  endpoint:
    health:
      probes:
        enabled: true
server:
  port: 8080
```

---

## Container Image Build

The project already has `spring-boot:build-image -Pnative` wired up via Maven. The CI workflow builds and pushes the OCI image to ECR.

Build produces a GraalVM native image packed into a lightweight container (no JVM, ~50–80 MB image).

---

## CI/CD — GitHub Actions

```yaml
# .github/workflows/deploy-backend.yml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - "src/**"
      - "pom.xml"
      - ".github/workflows/deploy-backend.yml"
  workflow_dispatch:

env:
  AWS_REGION: ap-south-1
  ECR_REPOSITORY: my-saloon-backend
  ECS_CLUSTER: my-saloon-cluster
  ECS_SERVICE: saloon-backend
  CONTAINER_NAME: saloon-backend

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write   # OIDC
      contents: read

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          java-version: "25"
          distribution: "graalvm"

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Log in to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push native image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          ./mvnw spring-boot:build-image -Pnative \
            -Dspring-boot.build-image.imageName=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
                     $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT
        id: build

      - name: Render ECS task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: .aws/task-definition.json
          container-name: ${{ env.CONTAINER_NAME }}
          image: ${{ steps.build.outputs.image }}

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true
```

The base task definition lives in `.aws/task-definition.json` (checked into the repo, image placeholder replaced at deploy time by the `render-task-definition` action).

**GitHub secrets/variables needed:**

| Key | Where | Value |
|-----|-------|-------|
| `AWS_DEPLOY_ROLE_ARN` | Secret | IAM role ARN (same role used for frontend deploys, or a separate backend role) |

---

## IAM Roles

### Deploy Role (GitHub Actions OIDC)

Trust policy: `token.actions.githubusercontent.com` — repo `samitkumarpatel/multi-tenant-saloon`, branch `main`.

Permissions:
- `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`, …
- `ecs:RegisterTaskDefinition`, `ecs:UpdateService`, `ecs:DescribeServices`, …
- `iam:PassRole` (for the ECS task execution role)

### ECS Task Execution Role

Standard `AmazonECSTaskExecutionRolePolicy` + permission to read the specific Secrets Manager paths:

```json
{
  "Effect": "Allow",
  "Action": ["secretsmanager:GetSecretValue"],
  "Resource": "arn:aws:secretsmanager:ap-south-1:*:secret:/multi-tenant-saloon/prod/*"
}
```

### ECS Task Role

Permissions the application itself needs at runtime (e.g., SES for email, S3 for uploads). Start empty and add as features are added.

---

## DNS (Route 53)

| Record | Type | Target |
|--------|------|--------|
| `api.my-saloon.online` | A (Alias) | ALB DNS name |

> The ALB certificate SANs only need `api.my-saloon.online`. This is separate from the CloudFront certificate (which covers `my-saloon.online` and `*.my-saloon.online`).

---

## Setup Checklist

### Phase 1 — AWS Infrastructure

- [ ] Create VPC with public/private subnets across 2 AZs (or reuse default VPC)
- [ ] Create NAT Gateway in each public subnet
- [ ] Create ECR repository `my-saloon-backend` with scan-on-push enabled
- [ ] Create RDS PostgreSQL instance in private subnets; store credentials in Secrets Manager
- [ ] Create ECS cluster `my-saloon-cluster`
- [ ] Create CloudWatch log group `/ecs/saloon-backend`
- [ ] Create ECS task execution IAM role with Secrets Manager read access
- [ ] Create ALB in public subnets with HTTPS listener and target group (port 8080)
- [ ] Request ACM certificate for `api.my-saloon.online` in `ap-south-1` (ALB region; NOT `us-east-1`)
- [ ] Register Route 53 Alias record `api.my-saloon.online` → ALB

### Phase 2 — Code Changes

- [ ] Add `src/main/resources/application-prod.yaml` with datasource env var references
- [ ] Verify `spring.sql.init.mode: always` with idempotent DDL (`CREATE TABLE IF NOT EXISTS`) in `V1__schema.sql`
- [ ] Add `.aws/task-definition.json` with base task definition (image placeholder)
- [ ] Expose `GET /actuator/health` (already available via Spring Boot Actuator; verify it's on classpath)

### Phase 3 — CI/CD

- [ ] Create IAM deploy role with OIDC trust policy for this repo
- [ ] Add `AWS_DEPLOY_ROLE_ARN` secret to GitHub
- [ ] Add `.github/workflows/deploy-backend.yml`
- [ ] Trigger workflow manually on first run; watch ECS service stabilise

### Phase 4 — Smoke Testing

- [ ] `GET https://api.my-saloon.online/actuator/health` → `{"status":"UP"}`
- [ ] `POST https://api.my-saloon.online/api/saloons` → creates a record (verify RDS connectivity)
- [ ] ECS task metrics (CPU/memory) visible in CloudWatch
- [ ] Log stream appears in `/ecs/saloon-backend`

---

## Cost Estimate (ap-south-1, low traffic)

| Resource | Approximate cost |
|----------|-----------------|
| ECS Fargate (1 task, 0.5 vCPU / 1 GB, ~70% Spot) | ~$5–8 / month |
| RDS `db.t4g.small` Multi-AZ | ~$35 / month |
| RDS `db.t4g.small` Single-AZ (staging) | ~$17 / month |
| ALB (1 LCU avg) | ~$5 / month |
| NAT Gateway (minimal traffic) | ~$7 / month |
| ECR storage (10 images × ~80 MB) | < $0.01 / month |
| Secrets Manager (3 secrets) | ~$0.12 / month |
| **Total (prod)** | **~$55–60 / month** |

> RDS Multi-AZ dominates the cost. Use a Single-AZ `db.t4g.micro` for staging to cut costs to ~$25/month.

---

## Known Constraints & Future Improvements

| Item | Note |
|------|------|
| Schema migrations | `spring.sql.init.mode: always` works for greenfield. When the schema stabilises, migrate to **Flyway** for versioned migrations and safe rollbacks. |
| Database pooling | Spring Boot auto-configures HikariCP. Default pool size (10) is fine for 1–2 Fargate tasks; tune `maximum-pool-size` if scaling beyond 5 tasks. |
| Secrets rotation | Secrets Manager supports automatic rotation for RDS. Enable it once the app is stable. |
| Blue/green deploys | The `amazon-ecs-deploy-task-definition` action does a rolling update by default. Switch to CodeDeploy blue/green if zero-downtime deployments are required. |
| Observability | Add AWS X-Ray tracing or OpenTelemetry SDK for distributed tracing across Spring Modulith events. |
