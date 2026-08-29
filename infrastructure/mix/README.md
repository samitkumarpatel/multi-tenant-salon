# `mix` environment

A cross-provider environment that **runs alongside the live `azure` environment**
without disturbing it:

| Layer | Provider | What |
|---|---|---|
| Frontend | **Cloudflare Pages** | one direct-upload project per SPA in `frontend/apps/*` |
| Backend | **Azure Container Apps** | `api` (`src/`) + `auth`, Consumption plan, scale-to-zero |
| Database | **Azure Database for PostgreSQL – Flexible Server** | Burstable `B1ms`, 32 GiB — the cheap dev/test tier (Azure has no true serverless PG) |
| DNS | **Azure DNS** | the *existing* `salonsaas.org` zone, mix adds only its own `*-m` records |

```
mix/
├── modules/
│   └── cloudflare-pages/     # cloudflare_pages_project (direct upload) + cloudflare_pages_domain
├── stacks/
│   ├── dns-zone/             # data-source lookup of the shared salonsaas.org zone (read-only)
│   ├── dns-update/           # record-only: CNAME/TXT that depend on module outputs
│   ├── frontend/             # for_each app -> modules/cloudflare-pages
│   └── backend/              # azure/modules/{container-apps-env,container-apps,key-vault} + managed-cert custom domains
└── environments/
    └── mix/                  # single Terraform root — wires the four stacks together
```

The Azure modules (`container-apps-env`, `container-apps`, `key-vault`) are reused
from `../azure/modules/` unchanged. `mix` creates no `resource-group` or
`dns-zone` module — it looks both up.

## Coexistence with `azure/` — one shared RG, one shared zone

`mix` and `azure/environments/dev` put **all** their Azure resources in the
**same resource group** (`multi-tenant-salon-dev`) and the **same DNS zone**
(`salonsaas.org`, in that RG). `azure/dev` creates and owns both; `mix` reads
them with data sources and only adds new, non-overlapping resources. So when
`azure/dev` is retired after the migration, nothing has to move — mix's
resources are already in the right RG.

| Thing | Owner | `mix` does | Collision? |
|---|---|---|---|
| Resource group `multi-tenant-salon-dev` | `azure/dev` | `data "azurerm_resource_group"` | no — read only |
| DNS zone `salonsaas.org` | `azure/dev` | `data "azurerm_dns_zone"` + adds `*-m` records | no — record names disjoint |
| Terraform state | — | `multitenantsaloon-mix.terraform.tfstate` (same storage account, distinct key) | no |
| Key Vault | — | `salon-saas-mix-kv` (vs `salon-saas-dev-kv`) | no |
| Container Apps env | — | `salon-saas-mix` (`azure/dev` uses AKS) | no |
| Cloudflare | — | all new | no |

mix's record resources live in **mix's** state, keyed by name (`admin-m`,
`api-m`, `asuid.api-m`, `onboarding`, …); `azure/dev`'s `terraform plan` never
sees them and shows no drift. MX / SPF / DKIM / apex / wildcard stay entirely
under `azure/dev`. The RG name is pinned in both roots — `local.resource_group_name`
in `azure/environments/dev/main.tf` and `var.azure_resource_group` in
`mix/environments/mix` (both `multi-tenant-salon-dev`); keep them in sync.

When `azure/dev` is retired, `terraform state rm` its RG + zone resources (or
`terraform import` them into mix) — the RG and zone themselves stay put.

## Sub-domain map (all under the shared `salonsaas.org` zone)

| App / service | Sub-domain | Target |
|---|---|---|
| salon-onboarding | `onboarding` | `<project>.pages.dev` |
| salon-admin | `admin-m` | `<project>.pages.dev` |
| salon-public-website | `public-m` | `<project>.pages.dev` |
| salon-super-admin | `super-admin-m` | `<project>.pages.dev` |
| salon-booking | `book-m` | `<project>.pages.dev` |
| salon-staff | `staff-m` | `<project>.pages.dev` |
| backend `api` | `api-m` | Container App FQDN (+ `asuid.api-m` TXT) |
| backend `auth` | `auth-m` | Container App FQDN (+ `asuid.auth-m` TXT) |

An explicit CNAME wins over `azure/dev`'s `*.salonsaas.org` wildcard, so these
names resolve to mix even though the wildcard exists.

## Database

`mix` provisions its own **Azure Database for PostgreSQL – Flexible Server**
(`salon-saas-mix-psql`, Burstable `B_Standard_B1ms` = 1 vCore / 2 GiB, 32 GiB
storage, 7‑day backups, single zone, no HA) in the shared RG. Azure has no true
scale-to-zero PostgreSQL; to stop paying for compute while idle,
`az postgres flexible-server stop -g multi-tenant-salon-dev -n salon-saas-mix-psql`
(auto-restarts after 7 days; storage is still billed).

The stack generates the admin password (`random_password`), stores it in Key
Vault (`spring-datasource-url` / `-username` / `-password`), and merges
`SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` into the `api` container's
env. The app runs Flyway (`SPRING_FLYWAY_ENABLED=true`) against the fresh DB on
first boot, so `V1..Vn` create the schema — no manual bootstrap.

```bash
terraform output database                       # server / db / jdbc_url / username
terraform output -raw database_password         # generated admin password
```

### Network access

The server has `public_network_access_enabled = true` but **no client is allowed
by default** — only the always-on `AllowAzureServices` (0.0.0.0) rule, which is
what lets the **Container Apps** *and* **AKS** deployments connect (both egress
from Azure-owned IP space). Nothing on the open internet can reach it until you
add an IP.

Open it to your laptop / any public place, on demand, without editing files:

```bash
terraform apply -var 'postgres_client_ips={"laptop":"'"$(curl -s ifconfig.me)"'"}'
# multiple: -var 'postgres_client_ips={"laptop":"203.0.113.7","office":"198.51.100.9"}'
```

Re-apply with `postgres_client_ips={}` (the default) to close it again. Then:

```bash
PGPASSWORD=$(terraform output -raw database_password) \
  psql "host=salon-saas-mix-psql.postgres.database.azure.com user=postgres dbname=salon sslmode=require"
```

**Data migration** from the AKS in-cluster Postgres (`helm/postgres`) is a
follow-up: `pg_dump` from the AKS pod → `psql`/`pg_restore` into this server.

## Deploy

```bash
cd infrastructure/mix/environments/mix
cp .env.example .env && $EDITOR .env && set -a && . ./.env && set +a

terraform init
```

The deploying identity needs **Contributor** on `multi-tenant-salon-dev` (to
create the Container Apps env + Key Vault in the shared RG) and **DNS Zone
Contributor** on the `salonsaas.org` zone. `azure/environments/dev` must have
been applied first so the RG and zone exist.

### Apply #1 — infra + DNS records (`bind_custom_domains = false`)

```bash
terraform apply -var bind_custom_domains=false
```

Creates (all inside the existing `multi-tenant-salon-dev` RG): 6 Cloudflare Pages
projects (+ their `cloudflare_pages_domain` registrations), the Container Apps
environment, `api` + `auth` apps, the PostgreSQL Flexible Server + `salon`
database, Key Vault (with the `spring-datasource-*` secrets), and every `*-m`
CNAME / `asuid` TXT record in the shared zone. No RG and no name-server
delegation step — both already exist.

### Wait for DNS

```bash
dig +short asuid.api-m.salonsaas.org  TXT
dig +short admin-m.salonsaas.org      CNAME
```

### Apply #2 — bind custom domains + managed TLS certs

```bash
terraform apply -var bind_custom_domains=true
```

Adds an Azure-managed certificate per backend sub-domain and binds `api-m` /
`auth-m` to their Container Apps. The `azapi` managed-certificate resource blocks
until issuance succeeds; if it errors because DNS had not fully propagated, just
re-run this apply. Cloudflare Pages custom domains validate asynchronously once
their CNAME resolves — no second step needed there.

## Push application content

Frontend — the per-app `.github/workflows/deploy-<app>.yml` workflows: the
`build` job now builds with the `-m` `VITE_*` values and the `deploy-cloudflare`
job runs `wrangler pages deploy` to `salonsaas-<app>`. The old `deploy` (AWS) and
`deploy-azure` (Blob + Front Door) jobs are kept but `if: false`. Locally:

```bash
npm --prefix frontend ci
VITE_API_BASE_URL=https://api-m.salonsaas.org \
VITE_SALON_DOMAIN=salonsaas.org \
VITE_BOOKING_BASE_URL=https://book-m.salonsaas.org \
  npm --prefix frontend run build:admin
npx wrangler pages deploy frontend/apps/salon-admin/build/client \
  --project-name=salonsaas-admin --branch=main
```

Backend — the `deploy-container-apps` job in `.github/workflows/deploy-backend.yml`
(the `deploy-azure` AKS/Helm job is now `if: false`), or:

```bash
az containerapp update -n salon-saas-mix-api  -g multi-tenant-salon-dev \
  --image ghcr.io/samitkumarpatel/multi-tenant-salon:<sha>
az containerapp update -n salon-saas-mix-auth -g multi-tenant-salon-dev \
  --image ghcr.io/samitkumarpatel/multi-tenant-salon-authz:<sha>
```

## Verify

```bash
curl -I https://admin-m.salonsaas.org                 # 200, server: cloudflare
curl    https://api-m.salonsaas.org/actuator/health   # {"status":"UP"}
terraform plan                                        # clean, no drift
# and confirm azure/dev is unaffected:
terraform -chdir=../../../azure/environments/dev plan # no changes
```

The PostgreSQL firewall allows Azure services (Container Apps + AKS egress) only.
For direct `psql` from elsewhere, pass `-var postgres_client_ips=...` (see
**Network access** above).

## CI secrets / variables

Secrets: `AZURE_CREDENTIALS`, `CLOUDFLARE_API_TOKEN` (Pages: Edit),
`CLOUDFLARE_ACCOUNT_ID`. No GitHub OIDC is used anywhere in this environment.
