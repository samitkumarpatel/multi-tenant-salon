# Infrastructure

Terraform infrastructure for multi-tenant-salon, organised as reusable modules consumed by purpose-scoped stacks.

```
infrastructure/
├── modules/
│   ├── dns-zone/        # Route 53 hosted zone — outputs zone ID + nameservers
│   ├── cloudfront/      # CloudFront distributions (one per key in distributions map)
│   ├── s3/              # S3 bucket with OAC wiring for CloudFront
│   ├── route53/         # Route 53 alias records for CloudFront distributions
│   ├── ecs/             # ECS Fargate cluster + internal ALB + auto-scaling
│   ├── rds/             # RDS PostgreSQL 17 + Secrets Manager credentials
│   ├── api-gateway/     # API Gateway v2 — HTTP + WebSocket APIs via VPC Link
│   ├── vpc/             # (unused by active stacks — kept for reference)
│   └── github-oidc/     # GitHub OIDC provider + IAM role for GitHub Actions
├── stacks/
│   ├── dns-bootstrapping/  # Phase 0: Route 53 zone + ACM certificates
│   ├── frontend/           # S3 + CloudFront + Lambda@Edge + Route 53 CF records
│   └── backend/            # Default VPC security groups + RDS + ECS + API Gateway
└── environments/
    ├── dev/             # Single Terraform root — calls all three stacks
    │   ├── providers.tf
    │   ├── main.tf
    │   ├── outputs.tf
    │   └── .env.example
    └── github-oidc/     # Separate root — deploys GitHub OIDC IAM role
        ├── providers.tf
        ├── main.tf
        └── outputs.tf
```

Each environment directory is a **single Terraform root** with one shared state file.  
The three stacks are called as child modules from `environments/dev/main.tf` and share state within the same `terraform apply`.

**Why three stacks?**
- **dns-bootstrapping** must be applied first (Phase 1 requires manual NS propagation at the registrar)
- **frontend** (S3/CloudFront) changes infrequently; blast radius is isolated from the backend
- **backend** (RDS/ECS/API GW) changes more often and independently of frontend

---

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.9
- AWS CLI configured, or `AWS_PROFILE` / `AWS_ACCESS_KEY_ID` set
- An S3 bucket for remote state (create once, manually — `tfpocbucket001` in eu-north-1)

---

## First-time deployment (fresh environment)

### Init

```bash
terraform -chdir=infrastructure/environments/dev init
```

### Phase 1 — Create the Route 53 hosted zone

Apply only the DNS zone to get the nameservers:

```bash
terraform -chdir=infrastructure/environments/dev apply \
  -target=module.dns_bootstrapping.module.dns_zone
```

Note the nameservers:

```bash
terraform -chdir=infrastructure/environments/dev output name_servers
```

Go to your domain registrar and update the NS records to the four values above.  
Wait for propagation (typically a few minutes to a few hours).

### Phase 2 — Certificates + full apply

Once NS records have propagated, run a full apply. Terraform will:
1. Request and validate ACM certificates (us-east-1 for CloudFront, eu-north-1 for API Gateway)
2. Provision all frontend resources (S3, CloudFront, Lambda@Edge, Route 53 records)
3. Provision all backend resources (Security groups, RDS, ECS, API Gateway)

```bash
terraform -chdir=infrastructure/environments/dev apply
```

---

## Outputs

```bash
terraform -chdir=infrastructure/environments/dev output
```

| Output | Stack | Use |
|--------|-------|-----|
| `name_servers` | dns-bootstrapping | Set at your domain registrar after Phase 1 |
| `cloudfront_main_id` | frontend | Set as `CF_MAIN_DIST_ID` GitHub Actions variable |
| `cloudfront_wildcard_id` | frontend | Set as `CF_WILDCARD_DIST_ID` GitHub Actions variable |
| `s3_buckets` | frontend | Bucket names for deploy sync commands |
| `cf_logs_bucket` | frontend | CloudFront access logs bucket |
| `resource_group_arn` | frontend | AWS Resource Group ARN for this environment |
| `api_endpoint` | backend | REST API base URL — set as `API_BASE_URL` in frontend apps |
| `ws_endpoint` | backend | WebSocket URL — set as `WS_URL` in frontend apps |
| `ecs_cluster_name` | backend | Set as `ECS_CLUSTER` GitHub Actions variable |
| `ecs_service_names` | backend | Map of service key → ECS service name; set each as `ECS_SERVICE_<KEY>` |
| `rds_secret_path_prefix` | backend | Secrets Manager path prefix for DB credentials |

---

## State migration (existing `dev/1.0.0` state → new layout)

> **Skip this section** if you are deploying a fresh environment.

The previous layout had a single `stacks/1.0.0` module called `module.stack`.  
The new layout splits it into `module.frontend` and `module.backend`, and the S3 state key changed:

| | Old | New |
|---|---|---|
| State key | `dev/1.0.0/terraform.tfstate` | `dev/terraform.tfstate` |
| Frontend module path | `module.stack.*` | `module.frontend.*` |
| Backend module path | `module.stack.*` | `module.backend.*` |

### Step 1 — Copy the state file to the new key

```bash
aws s3 cp s3://tfpocbucket001/dev/1.0.0/terraform.tfstate \
          s3://tfpocbucket001/dev/terraform.tfstate \
          --region eu-north-1
```

### Step 2 — Re-initialise against the new key

```bash
terraform -chdir=infrastructure/environments/dev init -reconfigure
```

### Step 3 — Move all frontend resources in state

Data sources are ephemeral and excluded automatically. This renames every managed resource from `module.stack.*` → `module.frontend.*`:

```bash
terraform -chdir=infrastructure/environments/dev state list \
  | grep '^module\.stack\.' \
  | grep -v '^module\.stack\.data\.' \
  | while read addr; do
      new=$(echo "$addr" | sed 's/^module\.stack\./module.frontend./')
      terraform -chdir=infrastructure/environments/dev state mv "$addr" "$new"
    done
```

### Step 4 — Verify

Run a plan. Frontend resources should show **no changes**; backend resources (RDS, ECS, API Gateway, security groups) will show as **to be created** because they are new:

```bash
terraform -chdir=infrastructure/environments/dev plan
```

### Step 5 — Apply backend resources

```bash
terraform -chdir=infrastructure/environments/dev apply
```

---

## Day-to-day commands

```bash
# Plan only
terraform -chdir=infrastructure/environments/dev plan

# Apply
terraform -chdir=infrastructure/environments/dev apply

# Destroy (dev only — RDS deletion protection is off)
terraform -chdir=infrastructure/environments/dev destroy

# Format all Terraform files
terraform fmt -recursive infrastructure/

# Validate
terraform -chdir=infrastructure/environments/dev validate
```

---

## GitHub OIDC (one-time per AWS account)

```bash
terraform -chdir=infrastructure/environments/github-oidc init \
  -backend-config="bucket=tfpocbucket001" \
  -backend-config="key=github-oidc/terraform.tfstate" \
  -backend-config="region=eu-north-1" \
  -backend-config="encrypt=true"

terraform -chdir=infrastructure/environments/github-oidc apply
```

Set the `AWS_ROLE_ARN` GitHub Actions secret to the `github_actions_role_arn` output value.

---

## Adding a new environment

1. Copy `infrastructure/environments/dev/` to `infrastructure/environments/<env>/`
2. Update `providers.tf`: change `region`, backend `key` (e.g. `prod/terraform.tfstate`), and `default_tags`
3. Update `main.tf`: change `environment`, `name`, `domain`, and any environment-specific flags
4. Follow the two-phase deployment above

## Evolving a stack

Stacks are plain Terraform modules — there is no versioned directory naming convention.  
To make breaking changes to `frontend` or `backend`:

1. Edit the stack's `.tf` files directly
2. Run `terraform plan` in the affected environment to review the diff
3. Apply — Terraform's state tracks resources by address, so in-place edits are safe

If you need a zero-downtime blue/green cut-over for a particular environment, create a parallel environment (e.g. `environments/prod-v2/`) pointing at the same stacks, validate it, then update DNS.
