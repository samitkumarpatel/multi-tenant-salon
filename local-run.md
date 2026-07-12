# Local Development Guide

Three processes must run simultaneously: the **backend** (Spring Boot), the **onboarding MFE** (saloon-onboarding), and the **management MFE** (saloon).

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

## 2. Onboarding MFE — `frontend/saloon-onboarding`

Handles creating new saloons. Runs on **http://localhost:5173**.

```bash
cd frontend/saloon-onboarding
npm install          # first time only
npm run dev
```

### Environment variables

Create `frontend/saloon-onboarding/.env` if you need to override defaults:

```env
# Backend API — Vite dev server proxies /api to this target
VITE_API_BASE_URL=           # leave empty in dev (proxy handles it)

# Where the management MFE lives (used for "Manage →" links)
VITE_SALOON_APP_URL=http://localhost:5174
```

Both variables have defaults wired in `app/lib/config.ts` and `app/lib/api.ts`, so the `.env` file is optional for local dev.

## 3. Management MFE — `frontend/saloon`

Handles editing, services, staff, and deleting a saloon. Runs on **http://localhost:5174**.

```bash
cd frontend/saloon
npm install          # first time only
npm run dev
```

### Environment variables

Create `frontend/saloon/.env` if you need to override defaults:

```env
# Backend API — Vite dev server proxies /api to this target
VITE_API_BASE_URL=           # leave empty in dev (proxy handles it)

# Where the onboarding MFE lives (used for "← All Saloons" link)
VITE_ONBOARDING_APP_URL=http://localhost:5173
```

## Port summary

| Service | URL |
|---------|-----|
| Backend API | http://localhost:8080 |
| Onboarding MFE | http://localhost:5173 |
| Management MFE | http://localhost:5174 |

## Typical flow

1. Open **http://localhost:5173** — create a new saloon via the onboarding form.
2. After creation, the browser redirects automatically to the management MFE at **http://localhost:5174/:saloonId**.
3. From the management MFE, use the **← All Saloons** link to return to the onboarding list, or **Delete Saloon** to remove it.

## Running tests

```bash
# All tests (requires Docker for Testcontainers)
./mvnw test

# Single test class
./mvnw test -Dtest=MultiTenantSaloonApplicationTests

# TypeScript type check (frontend)
cd frontend/saloon-onboarding && npm run typecheck
cd frontend/saloon && npm run typecheck
```
