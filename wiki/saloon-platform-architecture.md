# Multi-tenant salon platform — micro-frontend architecture & build instructions

This document is the build spec for an AI coding agent (or a human dev) implementing the frontend layer. The backend API already exists; this only covers frontend module structure, integration contracts, and the shared-template strategy.

## 1. Modules

| Module | Audience | API base | Domain |
|---|---|---|---|
| `saloon-onboarding` | Saloon owner signup + customer discovery | `/api/saloon-onboarding/...` | `your-saloon.online` |
| `saloon-public-website` | End customer of a specific salon | `/api/saloon/<id>/...` | `<tenant>.your-saloon.online` |
| `saloon-admin` | Saloon owner back-office | `/api/saloon-admin/<id>/...` | `<tenant>.your-saloon.online/admin` |
| `saloon-super-admin` | Anthropic-side support/ops | `/api/saloon-super-admin/...` | `admin.your-saloon.online` |

Each module is an independently deployable app. Recommend **module federation (Webpack 5 / Vite plugin-federation)** or **single-spa** as the shell strategy, with a lightweight shell/root-config app that:
- resolves the active module from hostname + path,
- injects the tenant id (`saloonId`) into a shared context,
- handles cross-module auth token propagation.

## 2. The critical shared piece: the template module

`saloon-public-website` must be built as **two layers**:

1. **`@saloon/website-template`** — a standalone package (or federated remote) exporting:
   - presentational components (hero, services list, booking widget, webshop, membership cards, gallery, etc.)
   - a data layer that fetches exclusively from `/api/saloon/<id>/...`
   - a theme/layout schema (JSON) describing which sections are enabled, in what order, with what design tokens
2. **`saloon-public-website` app** — imports the template package, renders it read-only, adds SEO/meta, routing per page (home, services, book, webshop, membership).

`saloon-admin`'s design mode imports the **same** `@saloon/website-template` package and wraps it with an editing chrome:
- a design palette (drag/drop sections, edit theme tokens, toggle sections on/off)
- writes go to `/api/saloon-admin/<id>/website-config` (not the public API)
- preview renders through the identical template components, fed by the same shape of data, so what the owner sees in the palette is pixel-identical to what the customer sees live

**Rule for the agent:** never fork or duplicate template component markup between `saloon-admin` and `saloon-public-website`. If a component needs an "edit affordance" (e.g. hover-to-edit outline), implement it as an optional prop/slot on the shared component (`editable={true}`), not a separate component tree.

## 3. Suggested repo structure

```
/packages
  /website-template        # shared presentational + data layer (the "super important" piece)
  /design-system           # shared tokens, buttons, inputs, layout primitives used by ALL 4 apps
  /shared-auth             # token storage, tenant context, route guards
/apps
  /saloon-onboarding
  /saloon-public-website    # imports @saloon/website-template (read-only mode)
  /saloon-admin             # imports @saloon/website-template (editable mode) + full admin UI
  /saloon-super-admin
/shell                     # root-config / module federation host
```

## 4. Module responsibilities (for scoping agent tasks)

**saloon-onboarding**
- Owner signup flow → creates salon (draft) via `/api/saloon-onboarding/salons`
- Customer-facing "explore nearby salons" directory/search
- CRUD scoped entirely to onboarding namespace; no design/theme logic here

**saloon-admin**
- Auth-gated, tenant-scoped (`/admin` under tenant subdomain)
- Sections: basic info, services, staff, calendar/bookings, webshop, membership, website design & publish, settings
- Website design tab renders `@saloon/website-template` in edit mode; "Publish" writes the config that the public site will read
- All writes → `/api/saloon-admin/<id>/...`

**saloon-public-website**
- Renders `@saloon/website-template` in read-only mode
- Reads only from `/api/saloon/<id>/...`
- Booking, webshop checkout, membership signup as customer-facing flows
- Should support SSR/SSG for SEO (Next.js or similar) since it's public-facing and per-tenant

**saloon-super-admin**
- Cross-tenant dashboards: list/search all salons, impersonate/support tools, plan/billing overrides, moderation
- Reads/writes via `/api/saloon-super-admin/...` only — never touches per-tenant admin/public APIs directly

## 5. Cross-cutting concerns

- **Design system package**: buttons, form fields, cards, modals — shared by all 4 apps so they don't visually drift, even though `saloon-public-website`'s theme is tenant-customizable on top of it.
- **Auth**: separate token scopes per module (customer session vs owner session vs internal ops session). Shell/root-config should not let a super-admin token leak into a public-website request or vice versa.
- **Tenant resolution**: subdomain → `saloonId` lookup should happen once, at the shell level, and be passed down via context — don't re-resolve it independently in each module.
- **Versioning the template package**: since `saloon-admin` previews against it and `saloon-public-website` renders it live, treat `@saloon/website-template` as a versioned internal package with its own changelog — a breaking change here affects two apps at once.

## 6. Suggested build order for the agent

1. Scaffold `/packages/design-system` and `/packages/shared-auth`
2. Scaffold `/packages/website-template` with 2–3 core sections (hero, services, booking) wired to a mocked `/api/saloon/<id>` response
3. Scaffold `saloon-public-website` consuming the template read-only
4. Scaffold `saloon-admin`, starting with the website design tab consuming the same template in editable mode
5. Build out remaining `saloon-admin` CRUD sections (services, staff, calendar, webshop, membership)
6. Build `saloon-onboarding`
7. Build `saloon-super-admin`
8. Wire the shell/root-config for domain-based routing across all four
