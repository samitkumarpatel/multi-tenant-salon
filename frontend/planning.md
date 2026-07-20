# Frontend Microfrontend Architecture Plan

## Current State

Single React Router 7 app at `frontend/` mixing admin and customer concerns:

```
frontend/
  app/
    routes/
      home.tsx          # list all saloons (admin)
      new.tsx           # create saloon (admin)
      customer.tsx      # customer view (unused/mixed)
      layout.tsx        # per-saloon admin shell
      manage.tsx        # saloon dashboard
      edit.tsx          # edit saloon details
      services.tsx      # manage services
      staff.tsx         # manage staff
      website.tsx       # design/theme editor
      booking.tsx       # manage bookings
      help.tsx          # help
      saloon-page.tsx   # public website preview (mixed into admin routes)
      book.tsx          # customer booking flow
    components/         # all components mixed together
    lib/
      types.ts          # shared type definitions
      api.ts            # API helpers
      config.ts
      locale.ts
      theme.ts
```

---

## Target Architecture

### Monorepo Structure (npm workspaces)

```
frontend/
  package.json              # workspace root — no app code
  packages/
    ui-website/             # shared saloon public website template (pure React components)
    ui-shared/              # common form widgets and utilities
  apps/
    saloon-admin/           # saloon owner portal
    saloon-public-website/  # customer-facing site (thin shell, runtime multi-tenant)
    saloon-onboarding/      # platform landing + saloon signup flow
    saloon-super-admin/     # platform admin (internal)
```

### URL Routing (Production)

| URL Pattern | App | Notes |
|---|---|---|
| `my-saloon.online` | saloon-onboarding | landing page + "start free" |
| `my-saloon.online/signup` | saloon-onboarding | saloon owner signup |
| `admin.my-saloon.online/<saloon-handler>` | saloon-admin | owner portal; handler in path |
| `admin.my-saloon.online/<saloon-handler>/services` | saloon-admin | per-section routes |
| `glamour.my-saloon.online` | saloon-public-website | wildcard — 1 app, all saloons |
| `cuts4u.my-saloon.online` | saloon-public-website | same deployment, different tenant |
| `superadmin.my-saloon.online` | saloon-super-admin | internal only |

### AWS Infrastructure

```
Route 53
├── my-saloon.online            → CF dist #1 → s3://bucket/onboarding/
├── admin.my-saloon.online      → CF dist #2 → s3://bucket/admin/
├── superadmin.my-saloon.online → CF dist #3 → s3://bucket/super-admin/
└── *.my-saloon.online          → CF dist #4 → s3://bucket/public/
    (wildcard covers ALL saloon subdomains — 100 saloons = 0 infra changes)

ACM: one wildcard cert *.my-saloon.online covers all subdomains
```

Each CloudFront distribution needs:
- S3 origin with the appropriate path prefix
- `index.html` fallback for SPA routing (`403/404 → /index.html`)
- All CloudFront distributions are private; public access only via CF URLs

---

## Packages

### `packages/ui-website`

Pure React component library. No API calls, no routing, no side effects.
Accepts a `SaloonConfig` prop and renders the full public saloon website.

```ts
// packages/ui-website/src/index.ts
export interface SaloonConfig {
  saloon: Saloon;
  services: ServiceItem[];
  staff: StaffMember[];
  theme: WebsiteTheme;
  mode: "static" | "ai" | "contact";
}

export { SaloonWebsite } from './SaloonWebsite';
export { HoursTable }    from './HoursTable';
export { InfoBar }       from './InfoBar';
export { FeatureView }   from './FeatureView';
export { TileGrid }      from './TileGrid';
export { BookingWizard } from './BookingWizard';
export { SiteChrome }    from './SiteChrome';
```

**Consumed by:**
- `apps/saloon-admin` → `website.tsx` preview panel (with CSS scale transform for iframe effect)
- `apps/saloon-public-website` → root, feeds real API data from runtime tenant detection

### `packages/ui-shared`

Common form utilities used across multiple apps.

```
CountrySelect.tsx
PhoneInput.tsx
```

---

## App Details

### `apps/saloon-admin`

Saloon owner portal. Authenticated. Reads `/:saloonHandler` from URL path.

**Routes:**
```
/                              → home.tsx      (list owner's saloons)
/new                           → new.tsx       (create saloon)
/:saloonHandler                → layout.tsx    (per-saloon shell)
/:saloonHandler/               → manage.tsx    (dashboard)
/:saloonHandler/edit           → edit.tsx      (edit saloon info)
/:saloonHandler/services       → services.tsx  (service catalog)
/:saloonHandler/staff          → staff.tsx     (staff roster)
/:saloonHandler/website        → website.tsx   (theme editor + ui-website preview)
/:saloonHandler/booking        → booking.tsx   (booking management)
/:saloonHandler/help           → help.tsx
```

**Dev URL:** `http://localhost:5173`
**Prod URL:** `https://admin.my-saloon.online`

### `apps/saloon-public-website`

Thin shell. No routes beyond `/`. Reads hostname at runtime → API call → renders `<SaloonWebsite>`.

```ts
// root.tsx
const slug = window.location.hostname.split('.')[0]; // "glamour"
const config = await fetch(`/api/public/saloon?slug=${slug}`);
return <SaloonWebsite config={config} />;
```

Also serves the booking flow at `/book` (accepts query params for service/staff).

**Dev URL:** `http://localhost:5174`
**Prod URL:** `https://<any-saloon-slug>.my-saloon.online`

### `apps/saloon-onboarding`

Platform landing page. Unauthenticated. Two main flows:
- Saloon owners: explore, sign up, start onboarding
- Customers: search/discover saloons (optional for v1)

**Dev URL:** `http://localhost:5175`
**Prod URL:** `https://my-saloon.online`

### `apps/saloon-super-admin`

Internal platform management. Authenticated (super admin role only).
Manage all saloons, users, billing, feature flags.

**Dev URL:** `http://localhost:5176`
**Prod URL:** `https://superadmin.my-saloon.online`

---

## Route Migration Map

| Current route | Destination app |
|---|---|
| `home.tsx` | `saloon-admin` |
| `new.tsx` | `saloon-admin` |
| `customer.tsx` | `saloon-onboarding` (repurpose/rewrite) |
| `layout.tsx` | `saloon-admin` |
| `manage.tsx` | `saloon-admin` |
| `edit.tsx` | `saloon-admin` |
| `services.tsx` | `saloon-admin` |
| `staff.tsx` | `saloon-admin` |
| `website.tsx` | `saloon-admin` (uses `ui-website` for preview) |
| `booking.tsx` | `saloon-admin` |
| `help.tsx` | `saloon-admin` |
| `saloon-page.tsx` | `packages/ui-website` (becomes `SaloonWebsite` component) |
| `book.tsx` | `saloon-public-website` |

### Component Migration Map

| Current component | Destination |
|---|---|
| `SiteChrome.tsx` | `packages/ui-website` |
| `HoursTable.tsx` | `packages/ui-website` |
| `InfoBar.tsx` | `packages/ui-website` |
| `FeatureView.tsx` | `packages/ui-website` |
| `TileGrid.tsx` | `packages/ui-website` |
| `BookingWizard.tsx` | `packages/ui-website` |
| `CountrySelect.tsx` | `packages/ui-shared` |
| `PhoneInput.tsx` | `packages/ui-shared` |

### Shared Types

`app/lib/types.ts` → `packages/ui-website/src/types.ts` (exported as package types)
`app/lib/api.ts`, `app/lib/theme.ts`, etc. → keep per-app (each app has its own API layer)

---

## CI/CD — GitHub Actions

One workflow per app, triggered by path filters:

```yaml
# .github/workflows/deploy-saloon-admin.yml
on:
  push:
    branches: [main]
    paths:
      - 'frontend/apps/saloon-admin/**'
      - 'frontend/packages/**'        # shared changes also rebuild this app

# .github/workflows/deploy-saloon-public-website.yml
on:
  push:
    branches: [main]
    paths:
      - 'frontend/apps/saloon-public-website/**'
      - 'frontend/packages/**'

# (same pattern for onboarding and super-admin)
```

Build commands:
```bash
npm ci                                        # install all workspaces from root
npm run build --workspace=apps/saloon-admin   # build just this app
aws s3 sync dist/ s3://$BUCKET/admin/ --delete
aws cloudfront create-invalidation --distribution-id $CF_DIST --paths "/*"
```

---

## Implementation Phases

### Phase 1 — Monorepo scaffold (this session)
- [ ] Update `frontend/package.json` to npm workspaces root
- [ ] Create `apps/` and `packages/` directory structure
- [ ] Scaffold `packages/ui-website` with `package.json` and TypeScript config
- [ ] Scaffold `packages/ui-shared` with `package.json` and TypeScript config
- [ ] Scaffold all 4 apps under `apps/` with individual `package.json`, `vite.config.ts`, `react-router.config.ts`
- [ ] Move existing app files into `apps/saloon-admin`
- [ ] Migrate shared components into appropriate packages
- [ ] Wire package references (`"@saloon/ui-website": "workspace:*"`)
- [ ] Verify `npm install` and each app builds

### Phase 2 — Public website shell
- [ ] Implement runtime tenant detection in `saloon-public-website`
- [ ] Wire `SaloonWebsite` component from `ui-website`
- [ ] Implement `GET /api/public/saloon?slug=` backend endpoint

### Phase 3 — Admin website preview
- [ ] Update `website.tsx` in `saloon-admin` to use `ui-website` preview component
- [ ] CSS scale transform for preview panel

### Phase 4 — CI/CD
- [ ] Create 4 GitHub Actions workflow files
- [ ] Document S3 bucket + CloudFront setup steps

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Monorepo tool | npm workspaces | Already using npm; no extra tooling (not Turborepo/Nx for now) |
| Shared template | compile-time package (`ui-website`) | No Module Federation complexity; preview and live site use same components |
| Multi-tenancy | runtime hostname detection | One deployment serves 100 saloons; adding saloon = zero infra change |
| Admin URL | `admin.my-saloon.online/<saloon-handler>` | Avoids 3-level subdomain DNS wildcard limitation |
| Wildcard DNS | `*.my-saloon.online` (single Route 53 record) | Covers all saloon public subdomains with one cert and one CloudFront dist |
