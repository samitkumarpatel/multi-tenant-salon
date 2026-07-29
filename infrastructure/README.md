# Infrastructure

Terraform infrastructure for multi-tenant-saloon, organised as reusable modules consumed by versioned stacks.

```
infrastructure/
├── modules/          # Reusable building blocks (cloudfront, ecs, rds, route53, s3)
├── stacks/
│   └── 1.0.0/        # Current stack — frontend infrastructure (S3 + CloudFront + Route 53)
└── environments/
    └── dev/          # Dev environment variable values
        ├── .env.example
        └── terraform.tfvars
```

---

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.9
- AWS CLI configured, or `AWS_PROFILE` set
- An S3 bucket + DynamoDB table for remote state (create once, manually)
- ACM certificate for `<domain>` + `*.<domain>` in **us-east-1** (create once, manually)

---

## Setup

### 1. Create your `.env`

```bash
cp infrastructure/environments/dev/.env.example infrastructure/environments/dev/.env
```

Edit `.env` and fill in real values:

```bash
AWS_PROFILE=my-aws-profile

TF_BACKEND_BUCKET=my-saloon-terraform-state
TF_BACKEND_KEY=dev/1.0.0/terraform.tfstate
TF_BACKEND_REGION=ap-south-1
TF_BACKEND_DYNAMODB_TABLE=terraform-locks
```

### 2. Source the environment

Run this once per shell session (or add to a shell alias):

```bash
set -a; source infrastructure/environments/dev/.env; set +a
```

---

## Commands

All commands are run from the **repository root**. The `-chdir` flag points Terraform at the stack; `-var-file` points it at the environment values.

### Init

```bash
terraform -chdir=infrastructure/stacks/1.0.0 init \
  -backend-config="bucket=$TF_BACKEND_BUCKET" \
  -backend-config="key=$TF_BACKEND_KEY" \
  -backend-config="region=$TF_BACKEND_REGION" \
  -backend-config="dynamodb_table=$TF_BACKEND_DYNAMODB_TABLE" \
  -backend-config="encrypt=true"
```

### Plan

```bash
terraform -chdir=infrastructure/stacks/1.0.0 plan \
  -var-file=../../environments/dev/terraform.tfvars
```

### Apply

```bash
terraform -chdir=infrastructure/stacks/1.0.0 apply \
  -var-file=../../environments/dev/terraform.tfvars
```

### Outputs

After a successful apply, retrieve values needed for CI/CD:

```bash
terraform -chdir=infrastructure/stacks/1.0.0 output
```

Key outputs:

| Output | Use |
|--------|-----|
| `cloudfront_main_id` | Set as `CF_MAIN_DIST_ID` GitHub Actions variable |
| `cloudfront_wildcard_id` | Set as `CF_WILDCARD_DIST_ID` GitHub Actions variable |
| `s3_buckets` | Bucket names for the deploy sync commands |

### Destroy

```bash
terraform -chdir=infrastructure/stacks/1.0.0 destroy \
  -var-file=../../environments/dev/terraform.tfvars
```

### Validate / Format

```bash
terraform -chdir=infrastructure/stacks/1.0.0 validate
terraform fmt -recursive infrastructure/
```

---

## Adding a new environment

1. Create `infrastructure/environments/<env>/`
2. Add `.env.example` and `terraform.tfvars` with values for that environment
3. Use a unique `TF_BACKEND_KEY`, e.g. `prod/1.0.0/terraform.tfstate`
4. Run `init` → `plan` → `apply` as above, sourcing the new `.env`

## Adding a new stack version

1. Copy `infrastructure/stacks/1.0.0/` to `infrastructure/stacks/1.1.0/` (or next version)
2. Make changes to the new version's `.tf` files
3. Update `TF_BACKEND_KEY` in `.env` to point to the new version's state key
4. The previous version's state is untouched
