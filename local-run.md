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

Requires PostgreSQL running at `localhost:5432` with database `saloon`, user `postgres`, password `postgres` (matches `application.yaml` defaults).

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
npm run dev:admin        # saloon-admin       → http://localhost:5173
npm run dev:public       # saloon-public-website → http://localhost:5174
npm run dev:onboarding   # saloon-onboarding  → http://localhost:5175
npm run dev:super-admin  # saloon-super-admin → http://localhost:5176
```

Or `cd` into any app and run `npm run dev` directly:

```bash
cd frontend/apps/saloon-admin && npm run dev
```

All apps proxy `/api` requests to `http://localhost:8080` via the Vite dev server — no environment variables needed for local development.

### Environment variables

A root-level `frontend/.env` file (modelled on `frontend/.env.example`) applies to all apps. Per-app `.env` files under `frontend/apps/<app>/` take precedence.

| Variable | Default | Used by | Purpose |
|----------|---------|---------|---------|
| `VITE_API_BASE_URL` | `http://localhost:8080` | admin, onboarding, public-website, super-admin | Backend API origin. Defaults to the local backend in dev. Set to the deployed API URL in production. |
| `VITE_SALOON_DOMAIN` | `my-saloon.online` | admin, onboarding, public-website | Base domain for tenant URLs (e.g. `my-saloon.my-saloon.online`). The public-website uses this to extract the saloon slug from the subdomain; falls back to `?slug=` query param when running on `localhost`. |
| `VITE_ADMIN_APP_URL` | `http://localhost:5173` | onboarding | URL of the admin app; used to redirect after saloon creation. Set to the deployed admin URL in production. |

## Port summary

| Service | URL | Purpose |
|---------|-----|---------|
| Backend API | http://localhost:8080 | Spring Boot REST API |
| saloon-admin | http://localhost:5173 | Per-saloon management (bookings, services, staff) |
| saloon-public-website | http://localhost:5174 | Public-facing saloon website |
| saloon-onboarding | http://localhost:5175 | Create and explore saloons |
| saloon-super-admin | http://localhost:5176 | Platform-wide super admin |

## Typical flow

1. Open **http://localhost:5175** — create a new saloon via the onboarding form.
2. Use **http://localhost:5173** to manage a saloon (bookings, services, staff, settings).
3. Open **http://localhost:5174** to view the public-facing saloon website.
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
| `deploy-admin.yml` | `frontend/apps/saloon-admin/**`, `frontend/packages/ui-website/**` | `frontend/apps/saloon-admin/build/client` |
| `deploy-public-website.yml` | `frontend/apps/saloon-public-website/**`, `frontend/packages/ui-website/**` | `frontend/apps/saloon-public-website/build/client` |
| `deploy-onboarding.yml` | `frontend/apps/saloon-onboarding/**` | `frontend/apps/saloon-onboarding/build/client` |
| `deploy-super-admin.yml` | `frontend/apps/saloon-super-admin/**` | `frontend/apps/saloon-super-admin/build/client` |

### Deployment target — AWS S3 + CloudFront (wired but not active)

The deploy steps are scaffolded in each workflow but commented out. To activate, uncomment the `Deploy to S3` and `Invalidate CloudFront` steps and configure the following repository secrets:

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `AWS_REGION` | AWS region (e.g. `us-east-1`) |
| `S3_BUCKET` | S3 bucket name; each app deploys to a sub-path (`/admin/`, `/onboarding/`, `/public-website/`, `/super-admin/`) |
| `CF_DIST_ADMIN` | CloudFront distribution ID for `saloon-admin` |
| `CF_DIST_ONBOARDING` | CloudFront distribution ID for `saloon-onboarding` |
| `CF_DIST_PUBLIC` | CloudFront distribution ID for `saloon-public-website` |
| `CF_DIST_SUPER_ADMIN` | CloudFront distribution ID for `saloon-super-admin` |

When deploying to production, set the following environment variables (as GitHub Actions env vars or in the build step) so the apps point to the live API and correct domain:

```
VITE_API_BASE_URL=https://api.my-saloon.online
VITE_SALOON_DOMAIN=my-saloon.online
VITE_ADMIN_APP_URL=https://admin.my-saloon.online
```

## Running tests

```bash
# All backend tests (requires Docker for Testcontainers)
./mvnw test

# Single test class
./mvnw test -Dtest=MultiTenantSaloonApplicationTests

# TypeScript type check (all frontend apps)
cd frontend && npm run typecheck:all
```
