# Infrastructure

Terraform infrastructure for multi-tenant-saloon, organised as reusable modules consumed by versioned stacks.

```
infrastructure/
├── modules/
│   ├── dns-bootstrap/   # Route 53 hosted zone + ACM cert (us-east-1) + DNS validation
│   ├── cloudfront/
│   ├── ecs/
│   ├── rds/
│   ├── route53/
│   └── s3/
├── stacks/
│   ├── bootstrap/       # DNS bootstrap stack — hosted zone + ACM cert
│   └── 1.0.0/           # Main stack — S3 + CloudFront + Route 53 records
└── environments/
    └── dev/             # Single Terraform root — calls both stacks, wires outputs
        ├── providers.tf
        ├── variables.tf
        ├── main.tf      # calls stacks/bootstrap then stacks/1.0.0
        ├── outputs.tf
        ├── terraform.tfvars
        └── .env.example
```

Each environment directory is a **single Terraform root**. It calls `stacks/bootstrap` (Route 53 zone + ACM cert) and `stacks/1.0.0` (main infrastructure) together — Terraform resolves the dependency chain automatically via the wired outputs.

---

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.9
- AWS CLI configured, or `AWS_PROFILE` / `AWS_ACCESS_KEY_ID` set
- An S3 bucket for remote state (create once, manually)

---

## Deployment

### Init

```bash
terraform -chdir=infrastructure/environments/dev init \
  -backend-config="bucket=<state-bucket>" \
  -backend-config="key=dev/1.0.0/terraform.tfstate" \
  -backend-config="region=eu-north-1" \
  -backend-config="encrypt=true"
```

### Plan & Apply

```bash
terraform -chdir=infrastructure/environments/dev plan
terraform -chdir=infrastructure/environments/dev apply
```

A single `apply` creates the Route 53 hosted zone, requests and validates the ACM certificate, then provisions the full main stack — in the correct order via Terraform's dependency graph.

> After the first apply, note the `name_servers` output and point your domain registrar's NS records at them if not already done.

```bash
terraform -chdir=infrastructure/environments/dev output name_servers
```

### Outputs

```bash
terraform -chdir=infrastructure/environments/dev output
```

| Output | Use |
|--------|-----|
| `cloudfront_main_id` | Set as `CF_MAIN_DIST_ID` GitHub Actions variable |
| `cloudfront_wildcard_id` | Set as `CF_WILDCARD_DIST_ID` GitHub Actions variable |
| `s3_buckets` | Bucket names for deploy sync commands |
| `resource_group_arn` | AWS Resource Group ARN for this environment |

### Destroy

```bash
terraform -chdir=infrastructure/environments/dev destroy
```

### Validate / Format

```bash
terraform -chdir=infrastructure/environments/dev validate
terraform fmt -recursive infrastructure/
```

---

## Adding a new environment

1. Copy `infrastructure/environments/dev/` to `infrastructure/environments/<env>/`
2. Update both `terraform.tfvars` files (root and `bootstrap/`) with the new environment values
3. Use unique state keys: `<env>/bootstrap/terraform.tfstate` and `<env>/1.0.0/terraform.tfstate`
4. Run Phase 1 (bootstrap) then Phase 2 (main stack)

## Adding a new stack version

1. Copy `infrastructure/stacks/1.0.0/` to `infrastructure/stacks/1.1.0/`
2. Make changes to the new version's `.tf` files
3. Update the `source` in each environment's `main.tf` to point at the new version
4. Use a new state key (e.g. `dev/1.1.0/terraform.tfstate`) — the previous state is untouched
