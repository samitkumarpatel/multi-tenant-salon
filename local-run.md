# Local Development Guide

Two processes must run simultaneously: the **backend** (Spring Boot) and one or more **frontend apps** from the monorepo.

## Prerequisites

| Tool | Version |
|------|---------|
| Java | 25+ |
| Maven wrapper | included (`./mvnw`) |
| Node.js | 18+ |
| Docker | required for Testcontainers (tests only) |
| PostgreSQL | running on `localhost:5432` |

## 1. Backend — Spring Boot

### Option A: with Testcontainers (no local PostgreSQL needed)

Spins up a PostgreSQL container automatically via Testcontainers.

```bash
./mvnw spring-boot:test-run
```

### Option B: with a local PostgreSQL instance

Requires PostgreSQL running at `localhost:5432` with database `salon`, user `postgres`, password `postgres` (matches `application.yaml` defaults).

```bash
./mvnw spring-boot:run
```

Backend starts on **http://localhost:8080**.

## 2. Frontend — npm workspace monorepo

The frontend lives in `frontend/` and is an **npm workspace** with four apps under `frontend/apps/` and two shared packages under `frontend/packages/`.

### Install dependencies (first time only)

```bash
cd frontend
npm install
```

### Start individual apps

Run from the `frontend/` root using workspace scripts:

```bash
npm run dev:admin        # salon-admin       → http://localhost:5173
npm run dev:public       # salon-public-website → http://localhost:5174
npm run dev:onboarding   # salon-onboarding  → http://localhost:5175
npm run dev:super-admin  # salon-super-admin → http://localhost:5176
```

Or `cd` into any app and run `npm run dev` directly:

```bash
cd frontend/apps/salon-admin && npm run dev
```

All apps proxy `/api` requests to `http://localhost:8080` via the Vite dev server — no environment variables needed for local development.

### Environment variables

A root-level `frontend/.env` file (modelled on `frontend/.env.example`) applies to all apps. Per-app `.env` files under `frontend/apps/<app>/` take precedence.

| Variable | Default | Used by | Purpose |
|----------|---------|---------|---------|
| `VITE_API_BASE_URL` | `http://localhost:8080` | admin, onboarding, public-website, super-admin | Backend API origin. Defaults to the local backend in dev. Set to the deployed API URL in production. |
| `VITE_SALON_DOMAIN` | `my-salon.online` | admin, onboarding, public-website | Base domain for tenant URLs (e.g. `my-salon.my-salon.online`). The public-website uses this to extract the salon slug from the subdomain; falls back to `?slug=` query param when running on `localhost`. |
| `VITE_ADMIN_APP_URL` | `http://localhost:5173` | onboarding | URL of the admin app; used to redirect after salon creation. Set to the deployed admin URL in production. |

## Port summary

| Service | URL | Purpose |
|---------|-----|---------|
| Backend API | http://localhost:8080 | Spring Boot REST API |
| salon-admin | http://localhost:5173 | Per-salon management (bookings, services, staff) |
| salon-public-website | http://localhost:5174 | Public-facing salon website |
| salon-onboarding | http://localhost:5175 | Create and explore salons |
| salon-super-admin | http://localhost:5176 | Platform-wide super admin |

## Typical flow

1. Open **http://localhost:5175** — create a new salon via the onboarding form.
2. Use **http://localhost:5173** to manage a salon (bookings, services, staff, settings).
3. Open **http://localhost:5174** to view the public-facing salon website.
4. Use **http://localhost:5176** for platform-wide administration.

## Build all frontend apps

```bash
cd frontend
npm run build:all
```

Or build individually:

```bash
npm run build:admin
npm run build:public
npm run build:onboarding
npm run build:super-admin
```

## Deployment (CI/CD)

Each app has its own GitHub Actions workflow under `.github/workflows/` that triggers on pushes to `main` when files in that app (or its shared packages) change.

| Workflow | Trigger paths | Build artifact path |
|----------|--------------|---------------------|
| `deploy-admin.yml` | `frontend/apps/salon-admin/**`, `frontend/packages/ui-website/**` | `frontend/apps/salon-admin/build/client` |
| `deploy-public-website.yml` | `frontend/apps/salon-public-website/**`, `frontend/packages/ui-website/**` | `frontend/apps/salon-public-website/build/client` |
| `deploy-onboarding.yml` | `frontend/apps/salon-onboarding/**` | `frontend/apps/salon-onboarding/build/client` |
| `deploy-super-admin.yml` | `frontend/apps/salon-super-admin/**` | `frontend/apps/salon-super-admin/build/client` |

### Deployment target — AWS S3 + CloudFront (wired but not active)

The deploy steps are scaffolded in each workflow but commented out. To activate, uncomment the `Deploy to S3` and `Invalidate CloudFront` steps and configure the following repository secrets:

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `AWS_REGION` | AWS region (e.g. `us-east-1`) |
| `S3_BUCKET` | S3 bucket name; each app deploys to a sub-path (`/admin/`, `/onboarding/`, `/public-website/`, `/super-admin/`) |
| `CF_DIST_ADMIN` | CloudFront distribution ID for `salon-admin` |
| `CF_DIST_ONBOARDING` | CloudFront distribution ID for `salon-onboarding` |
| `CF_DIST_PUBLIC` | CloudFront distribution ID for `salon-public-website` |
| `CF_DIST_SUPER_ADMIN` | CloudFront distribution ID for `salon-super-admin` |

When deploying to production, set the following environment variables (as GitHub Actions env vars or in the build step) so the apps point to the live API and correct domain:

```
VITE_API_BASE_URL=https://api.my-salon.online
VITE_SALON_DOMAIN=my-salon.online
VITE_ADMIN_APP_URL=https://admin.my-salon.online
```

## Running tests

```bash
# All backend tests (requires Docker for Testcontainers)
./mvnw test

# Single test class
./mvnw test -Dtest=MultiTenantSalonApplicationTests

# TypeScript type check (all frontend apps)
cd frontend && npm run typecheck:all
```
