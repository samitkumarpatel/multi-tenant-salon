# Infrastructure

Terraform infrastructure for multi-tenant-saloon, organised as reusable modules consumed by versioned stacks.

```
infrastructure/
├── modules/
│   ├── dns-zone/        # Route 53 hosted zone — outputs zone ID + nameservers
│   ├── dns-cert/        # ACM certificate (us-east-1) + DNS validation records
│   ├── github-oidc/     # GitHub OIDC provider + IAM role for GitHub Actions
│   ├── cloudfront/
│   ├── ecs/
│   ├── rds/
│   ├── route53/
│   └── s3/
├── stacks/
│   ├── dns-bootstrapping/  # DNS bootstrap — Phase 1: zone, Phase 2: cert + validation
│   └── 1.0.0/              # Main stack — S3 + CloudFront + Route 53 records
└── environments/
    ├── dev/             # Single Terraform root — calls dns-bootstrapping then 1.0.0
    │   ├── providers.tf
    │   ├── main.tf
    │   ├── outputs.tf
    │   └── .env.example
    └── github-oidc/     # Separate root — deploys GitHub OIDC IAM role
        ├── providers.tf
        ├── main.tf
        └── outputs.tf
```

Each environment directory is a **single Terraform root**. The `dev/` environment calls `stacks/dns-bootstrapping` and `stacks/1.0.0` — but DNS bootstrapping must be applied in two phases to allow manual NS record propagation in between.

---

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.9
- AWS CLI configured, or `AWS_PROFILE` / `AWS_ACCESS_KEY_ID` set
- An S3 bucket for remote state (create once, manually)

---

## Deployment

### Init

The `dev` backend is hardcoded in `providers.tf` — no flags needed:

```bash
terraform -chdir=infrastructure/environments/dev init
```

---

### Phase 1 — Create the Route 53 hosted zone

Apply only the DNS zone to get the nameservers:

```bash
terraform -chdir=infrastructure/environments/dev apply \
  -target=module.dns_bootstrapping.module.dns_zone
```

Note the nameservers from the output:

```bash
terraform -chdir=infrastructure/environments/dev output name_servers
```

Go to your domain registrar and update the NS records to the four values above. Wait for propagation (typically a few minutes to a few hours).

---

### Phase 2 — Request and validate the ACM certificate + main stack

Once NS records have propagated, run a full apply. Terraform will:
1. Request the ACM certificate and write the DNS validation records into the zone
2. Wait for ACM to verify the certificate (requires NS propagation to be complete)
3. Provision the full main stack (S3, CloudFront, Route 53 records)

```bash
terraform -chdir=infrastructure/environments/dev apply
```

---

### Outputs

```bash
terraform -chdir=infrastructure/environments/dev output
```

| Output | Use |
|--------|-----|
| `name_servers` | Set at your domain registrar after Phase 1 |
| `cloudfront_main_id` | Set as `CF_MAIN_DIST_ID` GitHub Actions variable |
| `cloudfront_wildcard_id` | Set as `CF_WILDCARD_DIST_ID` GitHub Actions variable |
| `s3_buckets` | Bucket names for deploy sync commands |
| `resource_group_arn` | AWS Resource Group ARN for this environment |

---

### GitHub OIDC (one-time per AWS account)

```bash
terraform -chdir=infrastructure/environments/github-oidc init \
  -backend-config="bucket=<state-bucket>" \
  -backend-config="key=github-oidc/terraform.tfstate" \
  -backend-config="region=eu-north-1" \
  -backend-config="encrypt=true"

terraform -chdir=infrastructure/environments/github-oidc apply
```

Set the `AWS_ROLE_ARN` GitHub Actions secret to the `github_actions_role_arn` output value.

---

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
2. Update the hardcoded values in `providers.tf` and `main.tf` for the new environment
3. Use a unique state key in `providers.tf` backend block
4. Follow the two-phase deployment above

## Adding a new stack version

1. Copy `infrastructure/stacks/1.0.0/` to `infrastructure/stacks/1.1.0/`
2. Make changes to the new version's `.tf` files
3. Update the `source` in the environment's `main.tf` to point at the new version
4. Update the state `key` in `providers.tf` (e.g. `dev/1.1.0/terraform.tfstate`) — the previous state is untouched

---

## Migration guide

> **Only needed if you applied infrastructure before this refactor.** The module paths changed, so Terraform will try to destroy and recreate resources unless you move them in state first.

Two environments have state that needs migrating: `dev` and `github-oidc`.

### Before you start

Re-init both roots to pick up the new module sources:

```bash
terraform -chdir=infrastructure/environments/dev init -upgrade
terraform -chdir=infrastructure/environments/github-oidc init -upgrade \
  -backend-config="bucket=<state-bucket>" \
  -backend-config="key=github-oidc/terraform.tfstate" \
  -backend-config="region=eu-north-1" \
  -backend-config="encrypt=true"
```

---

### environments/dev — DNS bootstrapping

The `module.bootstrap` → `module.dns_bootstrapping` rename, combined with splitting `modules/dns-bootstrap` into `modules/dns-zone` and `modules/dns-cert`, changes every resource address under the bootstrap module.

```bash
cd infrastructure/environments/dev

# Route 53 hosted zone
terraform state mv \
  'module.bootstrap.module.dns_bootstrap.aws_route53_zone.this' \
  'module.dns_bootstrapping.module.dns_zone.aws_route53_zone.this'

# ACM certificate
terraform state mv \
  'module.bootstrap.module.dns_bootstrap.aws_acm_certificate.this' \
  'module.dns_bootstrapping.module.dns_cert.aws_acm_certificate.this'

# ACM certificate validation waiter
terraform state mv \
  'module.bootstrap.module.dns_bootstrap.aws_acm_certificate_validation.this' \
  'module.dns_bootstrapping.module.dns_cert.aws_acm_certificate_validation.this'

# DNS validation records (keyed by domain name)
terraform state mv \
  'module.bootstrap.module.dns_bootstrap.aws_route53_record.cert_validation["my-saloon.online"]' \
  'module.dns_bootstrapping.module.dns_cert.aws_route53_record.cert_validation["my-saloon.online"]'

terraform state mv \
  'module.bootstrap.module.dns_bootstrap.aws_route53_record.cert_validation["*.my-saloon.online"]' \
  'module.dns_bootstrapping.module.dns_cert.aws_route53_record.cert_validation["*.my-saloon.online"]'
```

Verify — plan should show no changes:

```bash
terraform plan
```

---

### environments/github-oidc — OIDC stack removed

The intermediate `stacks/github-oidc` layer was removed. `module.github_oidc` now points directly at `modules/github-oidc`, so the nested `module.github_oidc.module.github_oidc.*` path flattens by one level.

```bash
cd infrastructure/environments/github-oidc

terraform state mv \
  'module.github_oidc.module.github_oidc.aws_iam_openid_connect_provider.github' \
  'module.github_oidc.aws_iam_openid_connect_provider.github'

terraform state mv \
  'module.github_oidc.module.github_oidc.aws_iam_role.github_actions' \
  'module.github_oidc.aws_iam_role.github_actions'

terraform state mv \
  'module.github_oidc.module.github_oidc.aws_iam_role_policy.deploy' \
  'module.github_oidc.aws_iam_role_policy.deploy'
```

Verify — plan should show no changes:

```bash
terraform plan
```
