# Frontend Deployment Plan — S3 + CloudFront

## Apps & URL Mapping

| App | Local Port | Framework | Production URL |
|-----|-----------|-----------|---------------|
| `saloon-onboarding` | 5175 | React Router v7 | `https://my-saloon.online` |
| `saloon-admin` | 5173 | React Router v7 | `https://my-saloon.online/<saloon-id>` |
| `saloon-public-website` | 5174 | React Router v7 | `https://<saloon-id>.my-saloon.online` |
| `saloon-super-admin` | 5176 | React Router v7 | `https://admin.my-saloon.online` |

---

## Architecture Overview

```
                         ┌─────────────────────────────────────────────┐
                         │              Route 53 (DNS)                  │
                         │  my-saloon.online  →  CF Distribution #1    │
                         │  *.my-saloon.online →  CF Distribution #2   │
                         └───────────────┬─────────────────┬───────────┘
                                         │                 │
                    ┌────────────────────▼──┐     ┌───────▼────────────────────┐
                    │  CloudFront Dist #1   │     │   CloudFront Dist #2        │
                    │  my-saloon.online     │     │   *.my-saloon.online        │
                    │                       │     │                              │
                    │  CF Function routes:  │     │  Host: admin.my-saloon.*   │
                    │  / → onboarding       │     │  → S3: saloon-super-admin  │
                    │  /<slug> → admin      │     │                              │
                    └───────┬───────┬───────┘     │  Host: <slug>.my-saloon.*  │
                            │       │              │  → S3: saloon-public-web   │
                    ┌───────▼─┐  ┌──▼──────┐      │  (CF Fn extracts slug)     │
                    │ S3:     │  │ S3:     │      └───────────┬────────────────┘
                    │ main-   │  │ main-   │                  │
                    │ web/    │  │ web/    │         ┌────────┴──────────┐
                    │ onboard │  │ admin/  │         │                   │
                    └─────────┘  └─────────┘    ┌───▼──────┐   ┌───────▼──────┐
                                                │ S3:      │   │ S3:          │
                                                │ public-  │   │ super-admin  │
                                                │ web/     │   │              │
                                                └──────────┘   └──────────────┘
```

---

## AWS Resources

### ACM Certificate

One certificate in **us-east-1** (required for CloudFront) with two SANs:

- `my-saloon.online`
- `*.my-saloon.online`

Use DNS validation via Route 53.

### S3 Buckets

All buckets are **private** (no public access). CloudFront accesses them via **Origin Access Control (OAC)**.

| Bucket Name | Contents |
|-------------|---------|
| `my-saloon-main-web` | onboarding + admin builds in separate prefixes |
| `my-saloon-public-web` | public-website build |
| `my-saloon-super-admin-web` | super-admin build |
| `my-saloon-cf-logs` | CloudFront access logs |

```
my-saloon-main-web/
├── onboarding/           ← build output of saloon-onboarding
│   ├── index.html
│   └── assets/
└── admin/                ← build output of saloon-admin
    ├── index.html
    └── assets/
```

Upload commands after each build:

```bash
# onboarding
aws s3 sync apps/saloon-onboarding/build/client/ \
  s3://my-saloon-main-web/onboarding/ --delete

# admin
aws s3 sync apps/saloon-admin/build/client/ \
  s3://my-saloon-main-web/admin/ --delete

# public website
aws s3 sync apps/saloon-public-website/build/client/ \
  s3://my-saloon-public-web/ --delete

# super admin
aws s3 sync apps/saloon-super-admin/build/client/ \
  s3://my-saloon-super-admin-web/ --delete
```

### CloudFront Distribution #1 — `my-saloon.online`

**Domains:** `my-saloon.online`  
**Certificate:** ACM cert above  
**Origin:** S3 `my-saloon-main-web` via OAC  
**Logging:** `my-saloon-cf-logs/main/`

#### Cache Behaviors (evaluated top-to-bottom)

| Priority | Path Pattern | Action |
|----------|-------------|--------|
| 1 | `/onboarding/*` | Pass through to S3 as-is (serves built assets) |
| 2 | `/admin/*` | Pass through to S3 as-is (serves built assets) |
| 3 | Default (`/*`) | Attach **CF Function** `MainRouterFn` (see below) |

#### CloudFront Function — `MainRouterFn`

Runs on **viewer-request** for the default behavior. Routes between the two SPAs by rewriting the S3 object key — the browser URL remains unchanged so each SPA reads `window.location` normally.

```js
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Known onboarding paths — extend this list when new top-level pages are added
  var onboardingPaths = ['/', '/login', '/signup', '/forgot-password', '/verify'];

  var isOnboarding = onboardingPaths.indexOf(uri) !== -1
    || uri.startsWith('/onboard');   // any future /onboard/* prefix

  if (isOnboarding) {
    request.uri = '/onboarding/index.html';
    return request;
  }

  // Everything else: first path segment is the saloon slug → admin SPA
  request.uri = '/admin/index.html';
  return request;
}
```

> **Note:** When the onboarding app gains new top-level routes (e.g., `/pricing`), add them to `onboardingPaths` and redeploy the function. A future improvement is to move this list into a CloudFront KeyValueStore so it can be updated without a function deployment.

#### Custom Error Responses

| HTTP Error | Response Path | Response Code |
|------------|--------------|--------------|
| 403 | `/onboarding/index.html` | 200 |
| 404 | `/onboarding/index.html` | 200 |

S3 returns 403 for missing objects (bucket is private). Returning `index.html` ensures deep-linked SPA routes work. The SPA renders a 404 page if the route doesn't match internally.

#### Cache Policy

- Static assets (`/admin/assets/*`, `/onboarding/assets/*`): **Cache-Control: public, max-age=31536000, immutable** (set in S3 metadata or via response headers policy)
- HTML files: **Cache-Control: no-cache, no-store** (always revalidate)

---

### CloudFront Distribution #2 — `*.my-saloon.online`

**Domains:** `*.my-saloon.online`  
**Certificate:** ACM cert above  
**Logging:** `my-saloon-cf-logs/wildcard/`

This distribution handles two sub-domain namespaces:

| Subdomain | Purpose | S3 Origin |
|-----------|---------|----------|
| `admin.my-saloon.online` | Super admin dashboard | `my-saloon-super-admin-web` |
| `<slug>.my-saloon.online` | Per-saloon public page | `my-saloon-public-web` |

CloudFront supports only one default origin per distribution. Two origins are registered:

- **Origin A:** `my-saloon-public-web` (default origin)  
- **Origin B:** `my-saloon-super-admin-web`

#### Cache Behaviors

| Priority | Path Pattern | Associated Host | Origin |
|----------|-------------|----------------|--------|
| Default `/*` | All paths | determined by CF Function | Origin A (public) |

To switch origin based on the `Host` header, use **Lambda@Edge** at the origin-request stage (CloudFront Functions cannot change the origin):

```js
// Lambda@Edge — origin-request — Node 22.x runtime
export const handler = async (event) => {
  const request = event.Records[0].cf.request;
  const host = request.headers['host'][0].value; // e.g. "admin.my-saloon.online"

  if (host === 'admin.my-saloon.online') {
    // Override origin to super-admin bucket
    request.origin.s3.domainName = 'my-saloon-super-admin-web.s3.amazonaws.com';
    request.origin.s3.path = '';
    request.headers['host'] = [{ key: 'Host', value: 'my-saloon-super-admin-web.s3.amazonaws.com' }];
  }
  // else: default origin (public-web bucket) is already set

  // SPA fallback: always serve index.html for non-asset paths
  if (!request.uri.match(/\.(js|css|png|jpg|svg|ico|woff2?|json|map)$/)) {
    request.uri = '/index.html';
  }

  return request;
};
```

The **public-website** SPA reads the saloon slug from the subdomain directly:

```ts
// In the app
const slug = window.location.hostname.split('.')[0]; // "abc123" from "abc123.my-saloon.online"
```

This is already how the dev server middleware handles it (rewriting the path to `?slug=<slug>` in local dev).

#### Custom Error Responses (Distribution #2)

| HTTP Error | Response Path | Response Code |
|------------|--------------|--------------|
| 403 | `/index.html` | 200 |
| 404 | `/index.html` | 200 |

---

## Required Code Changes

### 1. Switch all apps to SPA mode

All four apps use React Router v7 framework mode, which defaults to SSR with a Node.js server. Static S3 hosting requires SPA mode.

Add or update `react-router.config.ts` in each app:

```ts
// apps/saloon-admin/react-router.config.ts
// apps/saloon-onboarding/react-router.config.ts
// apps/saloon-public-website/react-router.config.ts
// apps/saloon-super-admin/react-router.config.ts

import type { Config } from '@react-router/dev/config';

export default {
  ssr: false,
} satisfies Config;
```

After this change `npm run build` outputs only `build/client/` (no `build/server/`).

### 2. Asset base paths — injected at build time via CI

Onboarding and admin share one S3 bucket (`my-saloon-main-web`) in separate prefixes. Both `vite.config.ts` files already read `VITE_BASE_PATH` from the environment:

```ts
base: process.env.VITE_BASE_PATH ?? "/",
```

The GitHub Actions workflows inject the correct value at build time — no hardcoding in source:

- `deploy-onboarding.yml` → `VITE_BASE_PATH: /onboarding/`
- `deploy-admin.yml` → `VITE_BASE_PATH: /admin/`

Local dev runs without the env var, so `base` stays `"/"` and the dev server works unchanged.

> `saloon-public-website` and `saloon-super-admin` each have their own S3 bucket, so no base path override is needed.

### 3. Admin app: route the saloon slug from the URL

The admin app's React Router routes need to treat the first path segment as the saloon identifier. Update the root route to include a dynamic segment:

```
/ (root layout)
└── /:saloonId (layout with saloon context provider)
    ├── / (dashboard)
    ├── /services
    ├── /staff
    └── ...
```

---

## DNS (Route 53)

Both records are **Alias** records pointing to CloudFront distributions (no TTL management needed):

| Record | Type | Target |
|--------|------|--------|
| `my-saloon.online` | A (Alias) | CloudFront Distribution #1 domain |
| `*.my-saloon.online` | A (Alias) | CloudFront Distribution #2 domain |

> Route 53 does not support wildcard Alias records for apex (`my-saloon.online` itself). The apex and wildcard need separate records pointing to separate CloudFront distributions, which is exactly what is described above.

---

## CI/CD — GitHub Actions

One reusable workflow per app, triggered on push to `main` or manually.

```yaml
# .github/workflows/deploy-frontend.yml
name: Deploy Frontend

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'
  workflow_dispatch:

env:
  AWS_REGION: ap-south-1          # change to your region for S3
  CF_MAIN_DIST_ID: ${{ vars.CF_MAIN_DIST_ID }}
  CF_WILDCARD_DIST_ID: ${{ vars.CF_WILDCARD_DIST_ID }}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write   # for OIDC
      contents: read

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Build all apps
        working-directory: frontend
        run: npm run build:all

      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Deploy onboarding
        working-directory: frontend
        run: |
          aws s3 sync apps/saloon-onboarding/build/client/ \
            s3://my-saloon-main-web/onboarding/ \
            --delete \
            --cache-control "public, max-age=31536000, immutable" \
            --exclude "*.html"
          aws s3 sync apps/saloon-onboarding/build/client/ \
            s3://my-saloon-main-web/onboarding/ \
            --delete \
            --cache-control "no-cache, no-store" \
            --include "*.html" \
            --exclude "*"

      - name: Deploy admin
        working-directory: frontend
        run: |
          aws s3 sync apps/saloon-admin/build/client/ \
            s3://my-saloon-main-web/admin/ \
            --delete \
            --cache-control "public, max-age=31536000, immutable" \
            --exclude "*.html"
          aws s3 sync apps/saloon-admin/build/client/ \
            s3://my-saloon-main-web/admin/ \
            --delete \
            --cache-control "no-cache, no-store" \
            --include "*.html" \
            --exclude "*"

      - name: Deploy public website
        working-directory: frontend
        run: |
          aws s3 sync apps/saloon-public-website/build/client/ \
            s3://my-saloon-public-web/ \
            --delete \
            --cache-control "public, max-age=31536000, immutable" \
            --exclude "*.html"
          aws s3 sync apps/saloon-public-website/build/client/ \
            s3://my-saloon-public-web/ \
            --delete \
            --cache-control "no-cache, no-store" \
            --include "*.html" \
            --exclude "*"

      - name: Deploy super admin
        working-directory: frontend
        run: |
          aws s3 sync apps/saloon-super-admin/build/client/ \
            s3://my-saloon-super-admin-web/ \
            --delete \
            --cache-control "public, max-age=31536000, immutable" \
            --exclude "*.html"
          aws s3 sync apps/saloon-super-admin/build/client/ \
            s3://my-saloon-super-admin-web/ \
            --delete \
            --cache-control "no-cache, no-store" \
            --include "*.html" \
            --exclude "*"

      - name: Invalidate CloudFront caches
        run: |
          aws cloudfront create-invalidation \
            --distribution-id $CF_MAIN_DIST_ID \
            --paths "/onboarding/*" "/admin/*"
          aws cloudfront create-invalidation \
            --distribution-id $CF_WILDCARD_DIST_ID \
            --paths "/*"
```

**GitHub repository variables/secrets needed:**

| Key | Where | Value |
|-----|-------|-------|
| `AWS_DEPLOY_ROLE_ARN` | Secret | IAM role ARN with S3 + CloudFront permissions |
| `CF_MAIN_DIST_ID` | Variable | CloudFront Distribution #1 ID |
| `CF_WILDCARD_DIST_ID` | Variable | CloudFront Distribution #2 ID |

Use **OIDC federation** instead of long-lived AWS access keys. The IAM role trust policy should restrict to this repo and the `main` branch.

---

## Setup Checklist

### Phase 1 — AWS infrastructure

- [ ] Request ACM certificate for `my-saloon.online` + `*.my-saloon.online` in `us-east-1`
- [ ] Create S3 buckets: `my-saloon-main-web`, `my-saloon-public-web`, `my-saloon-super-admin-web`, `my-saloon-cf-logs`
- [ ] Block all public access on all S3 buckets
- [ ] Create CloudFront Distribution #1 (`my-saloon.online`) with OAC on `my-saloon-main-web`
- [ ] Attach `MainRouterFn` CloudFront Function to Distribution #1 default behavior
- [ ] Configure cache behaviors and error responses for Distribution #1
- [ ] Create CloudFront Distribution #2 (`*.my-saloon.online`) with two origins + Lambda@Edge
- [ ] Configure custom error responses for Distribution #2
- [ ] Set Route 53 Alias records for `my-saloon.online` and `*.my-saloon.online`

### Phase 2 — Code changes

- [ ] Add `react-router.config.ts` with `ssr: false` to all four apps
- [x] `VITE_BASE_PATH` injected via CI workflows (no source change needed)
- [ ] Update admin app routes to use `/:saloonId` as the root dynamic segment
- [ ] Verify `window.location.hostname` slug extraction works in `saloon-public-website`
- [ ] Build all apps locally and verify output in `build/client/`

### Phase 3 — CI/CD

- [ ] Create IAM role with OIDC trust policy for this GitHub repo
- [ ] Add `AWS_DEPLOY_ROLE_ARN` secret and `CF_MAIN_DIST_ID`, `CF_WILDCARD_DIST_ID` variables to GitHub
- [ ] Add `.github/workflows/deploy-frontend.yml`
- [ ] Trigger workflow on a test branch and verify S3 sync + invalidation

### Phase 4 — Smoke testing

- [ ] `https://my-saloon.online` → onboarding landing page loads
- [ ] `https://my-saloon.online/login` → onboarding login page loads
- [ ] `https://my-saloon.online/test-saloon` → admin dashboard for `test-saloon` loads
- [ ] `https://test-saloon.my-saloon.online` → public website for `test-saloon` loads
- [ ] `https://admin.my-saloon.online` → super admin dashboard loads
- [ ] Hard-refresh on a deep admin URL (`/<slug>/services`) loads the page correctly

---

## Cost Estimate (approximate, ap-south-1 region)

| Resource | Approximate cost |
|----------|-----------------|
| S3 storage (3 buckets, ~50 MB total) | < $0.01 / month |
| S3 PUT/GET requests | < $1 / month at moderate traffic |
| CloudFront (2 distributions, 10 GB/month transfer) | ~$0.85 / month |
| CloudFront Function invocations (1M / month) | $0.10 / month |
| Lambda@Edge invocations (1M / month) | ~$0.20 / month |
| Route 53 hosted zone | $0.50 / month |
| **Total** | **~$2–5 / month** at low-to-moderate traffic |

---

## Known Constraints & Future Improvements

| Item | Note |
|------|------|
| `MainRouterFn` onboarding path list | Must be kept in sync with routes in `saloon-onboarding`. Consider CloudFront KeyValueStore to update without redeploying the function. |
| Lambda@Edge cold starts | Adds ~50–200 ms latency on first request per edge location for Distribution #2. Consider CloudFront Functions with a fixed origin and handling origin switching via a different mechanism if this becomes a concern. |
| SSR / SEO for public website | SPA mode means crawlers receive an empty shell. If SEO is important for `<slug>.my-saloon.online`, consider deploying `saloon-public-website` to AWS Lambda + CloudFront (keeping SSR) instead of S3 SPA mode. |
| Per-app independent deploys | The current workflow rebuilds all apps on every push. Split into per-app jobs with `paths` filters to deploy only the changed app. |
