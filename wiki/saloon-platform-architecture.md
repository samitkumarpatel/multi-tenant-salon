# Saloon SaaS Platform — Architecture

Architecture diagram: [`others/saloon_saas_architecture.svg`](../others/saloon_saas_architecture.svg)

---

## Overview

A **multi-tenant SaaS platform** for saloon/salon management. Each saloon is a tenant. The platform is composed of four microfrontend applications backed by a single **Spring Modulith** backend.

---

## Frontend — Microfrontend Layer (Module Federation)

All four apps are independently deployable microfrontends wired together with Webpack Module Federation (or equivalent). They share a common design system and auth token but can be developed, tested, and deployed independently.

| App | Audience | Responsibilities |
|-----|----------|-----------------|
| **saloon-onboarding** | New saloon owners | Registration wizard, initial setup, handler selection |
| **saloon-public-website** | End customers | Booking flow, service catalog, staff gallery, real-time theme rendering |
| **saloon-admin** | Saloon owner / manager | Staff management, service catalog, booking calendar, theme editor |
| **saloon-super-admin** | Platform operators | Tenant management, platform-wide configuration, billing |

### saloon-public-website — special: real-time theming

This app is unique because its visual appearance is controlled at runtime by the saloon-admin. When an admin changes the theme (header/footer/hero background colors, accent color, font), the public website reflects those changes **without a deploy**. See the [Real-time Theme Flow](#real-time-theme-update-flow) section below.

---

## Backend — Modulith

A **modular monolith** built with [Spring Modulith](https://docs.spring.io/spring-modulith/reference/). Modules live under `net.samitkumar.multi_tenant_saloon` as top-level packages. Module boundaries are enforced at compile-time by Modulith. Cross-module communication uses **Spring Application Events**, never direct bean injection.

### Stack

- Java 25, Spring Boot 4.1, Spring Modulith 2.0.6
- Spring Data JDBC (PostgreSQL)
- Testcontainers for integration tests
- GraalVM Native Image ready

### Modules

#### Business modules

| Module | Package | Responsibilities |
|--------|---------|-----------------|
| **saloon** | `saloon` | Core aggregate: `Saloon` entity, owner/location/contact info, operating hours, features. Publishes `SaloonCreatedEvent` and `WebsitePublishRequestedEvent`. |
| **saloonservice** | `saloonservice` | `ServiceItem` catalog per saloon (name, price, duration, category, assigned staff). |
| **staff** | `staff` | `StaffMember` roster per saloon (role, status, specializations, availability). Publishes `StaffOnboardedEvent`. |
| **booking** | `booking` | Appointments, available slot calculation, staff availability schedule and overrides. Publishes `BookingCreatedEvent`, `BookingStatusChangedEvent`, `BookingRescheduledEvent`, `StaffScheduleUpdatedEvent`, `StaffAvailabilityOverrideAddedEvent/RemovedEvent`. |
| **website** | `website` | `WebsiteTheme` per saloon (colors, font, maps URL, website mode). Listens to `WebsitePublishRequestedEvent`. |

#### Support modules

| Module | Package | Responsibilities |
|--------|---------|-----------------|
| **notification** | `notification` | Listens to booking and saloon events; dispatches SMS/email/push. Has **no REST endpoint** — purely event-driven. |
| **utility** | `utility` | Shared reference data (country list). Exposed via `/api/saloon-utility/countries`. |

---

## API Route Namespaces

All API routes share the `/api` base prefix. The next path segment determines the owning module and access level:

| Prefix | Used by | Auth | Notes |
|--------|---------|------|-------|
| `/api/saloon-onboarding` | saloon-onboarding app | Public | `POST /api/saloon-onboarding` — creates a new saloon tenant |
| `/api/saloon/{id-or-handler}/...` | saloon-public-website | Public (read-only) | Customer-facing: services, staff, booking slots, website theme |
| `/api/saloon-admin/{id}/...` | saloon-admin app | Authenticated | All write operations: staff CRUD, service CRUD, booking management, theme, availability |
| `/api/saloon-super-admin/...` | saloon-super-admin app | Admin auth | Platform-wide tenant management |
| `/api/saloon-utility/...` | All apps | Public | Reference data (countries, enums) |

### Endpoint quick-reference

#### Saloon onboarding
```
POST   /api/saloon-onboarding                           Create new saloon
GET    /api/saloon-onboarding                           List all saloons (admin use)
```

#### Public (customer-facing)
```
GET    /api/saloon/{id}                                 Get saloon detail
GET    /api/saloon/{id}/services                        List services
GET    /api/saloon/{id}/services/{serviceId}            Get service
GET    /api/saloon/{id}/staff                           List staff
GET    /api/saloon/{id}/staff/{staffId}                 Get staff member
GET    /api/saloon/{id}/slots?date=&staffId=            Available booking slots
POST   /api/saloon/{id}/booking                         Create booking (customer)
GET    /api/saloon/{id}/website                         Get website theme
```

#### Saloon admin
```
GET/PUT  /api/saloon-admin/{id}                         Get/update saloon
PUT      /api/saloon-admin/{id}/features                Update enabled features
DELETE   /api/saloon-admin/{id}                         Delete saloon
POST     /api/saloon-admin/{id}/website/publish         Trigger website publish

GET/PUT  /api/saloon-admin/{id}/website                 Get/update website theme
GET      /api/saloon-admin/{id}/website-type            Get website mode
PATCH    /api/saloon-admin/{id}/website-type            Update website mode

GET/POST /api/saloon-admin/{id}/services                List/create services
GET/PUT/DELETE /api/saloon-admin/{id}/services/{svcId}  Manage service

GET/POST /api/saloon-admin/{id}/staff                   List/create staff
GET/PUT/DELETE /api/saloon-admin/{id}/staff/{staffId}   Manage staff member

GET/PUT  /api/saloon-admin/{id}/staff/{staffId}/availability             Weekly schedule
GET/POST /api/saloon-admin/{id}/staff/{staffId}/availability/overrides   Date overrides
DELETE   /api/saloon-admin/{id}/staff/{staffId}/availability/overrides/{oid}

GET/POST /api/saloon-admin/{id}/booking                 List/create bookings
GET/PUT/DELETE /api/saloon-admin/{id}/booking/{bookingId} Manage booking
POST     /api/saloon-admin/{id}/booking/{bookingId}/confirm
POST     /api/saloon-admin/{id}/booking/{bookingId}/cancel
POST     /api/saloon-admin/{id}/booking/{bookingId}/complete
POST     /api/saloon-admin/{id}/booking/{bookingId}/no-show
GET      /api/saloon-admin/{id}/slots                   Available slots (admin view)
```

#### Utility
```
GET    /api/saloon-utility/countries                    Country list
```

---

## Spring Application Events

Modules communicate exclusively through Spring Application Events annotated with `@ApplicationModuleListener`. Events are persisted via `spring-modulith-starter-jdbc` before dispatch, guaranteeing at-least-once delivery even across transaction boundaries.

| Event | Publisher | Listeners |
|-------|-----------|-----------|
| `SaloonCreatedEvent` | `saloon` | `notification` (welcome email), `staff` (auto-create owner staff entry) |
| `WebsitePublishRequestedEvent` | `saloon` | `website` (invoke AWS deployment pipeline) |
| `StaffOnboardedEvent` | `staff` | `booking` (initialise default availability schedule) |
| `BookingCreatedEvent` | `booking` | `notification` (confirmation SMS/email) |
| `BookingStatusChangedEvent` | `booking` | `notification` (status update alert) |
| `BookingRescheduledEvent` | `booking` | `notification` |
| `StaffScheduleUpdatedEvent` | `booking` | — (reserved for downstream consumers) |
| `StaffAvailabilityOverrideAddedEvent` | `booking` | — |
| `StaffAvailabilityOverrideRemovedEvent` | `booking` | — |

---

## Real-time Theme Update Flow

The **saloon-public-website** can reflect theme changes made in the **saloon-admin** instantly — without a redeploy or page reload.

```
saloon-admin
  └─ edits header_bg / footer_bg / hero_bg / accent_color / font_family / logo_bg_color
  └─ PUT /api/saloon-admin/{id}/website  →  WebsiteThemeService  →  saves to saloon_website_theme table

(Optional explicit publish)
  └─ POST /api/saloon-admin/{id}/website/publish  →  WebsitePublishRequestedEvent
  └─ WebsitePublishListener  →  deploys static assets to S3, creates Route 53 subdomain

SSE push (planned)
  └─ theme-change event  →  Server-Sent Events endpoint  →  saloon-public-website EventSource listener
  └─ re-fetches GET /api/saloon/{id}/website  →  re-renders header / footer / hero in-place
```

**Theme fields stored per tenant (`saloon_website_theme`):**

| Field | Default | Description |
|-------|---------|-------------|
| `hero_bg` | `#F8FAFC` | Hero section background |
| `hero_text_color` | `#0F172A` | Hero heading/subtext color |
| `accent_color` | `#059669` | Buttons, links, highlights |
| `font_family` | `nunito` | Body font |
| `logo_bg_color` | `#7C3AED` | Logo container background |
| `header_bg` | `#FFFFFF` | Header/navbar background |
| `footer_bg` | `#1E293B` | Footer background |
| `maps_url` | `null` | Embedded Google Maps URL |
| `website_mode` | `STATIC_WEBSITE` | `STATIC_WEBSITE`, `GENERATIVE_UI`, or `CUSTOMISE_WEBSITE_CONTACT_US` |

---

## Data Layer

### Multi-tenancy strategy

Each saloon is a tenant identified by its `id` (UUID) and `handler` (URL slug). The handler is used as the subdomain key: `{handler}.yourbrand.com`.

| Strategy | When used | Isolation |
|----------|-----------|-----------|
| **Shared DB, row-level isolation** | Default (all tenants) | `tenant_id` / `saloon_id` column on every table |
| **Schema-per-tenant DB** | Premium / enterprise tenants | Separate PostgreSQL schema per tenant |

### Caching (Redis)
- Session tokens
- Real-time booking slot availability (short TTL)
- Website theme (to avoid DB reads on every public page load)

---

## Multi-tenancy Resolution

```
Request: GET acmesaloon.yourbrand.com/services
  └─ API Gateway extracts subdomain  →  handler = "acmesaloon"
  └─ Resolves to saloon.id via handler lookup
  └─ All downstream queries scoped to that saloon_id
```

Custom domain mapping (`mycustomsaloon.com` → handler) is also supported.

---

## Implementation Plan

### Phase 1 — Backend alignment (current)
- [x] `saloon` module — core entity, onboarding API
- [x] `saloonservice` module — service catalog API
- [x] `staff` module — roster and availability
- [x] `booking` module — appointments, slots, overrides
- [x] `website` module — theme CRUD, publish event
- [x] `notification` module — event listeners (stub)
- [x] `utility` module — countries

### Phase 2 — Microfrontend scaffold
- [ ] Set up Module Federation host shell
- [ ] `saloon-onboarding` remote — registration wizard
- [ ] `saloon-public-website` remote — customer booking + theme rendering
- [ ] `saloon-admin` remote — management dashboard
- [ ] `saloon-super-admin` remote — platform ops

### Phase 3 — Real-time theme push
- [ ] Add SSE endpoint: `GET /api/saloon/{id}/website/events`
- [ ] Emit theme-change server-sent event on `PUT /api/saloon-admin/{id}/website`
- [ ] `saloon-public-website` opens `EventSource` and hot-swaps CSS variables on event

### Phase 4 — Website publish pipeline
- [ ] AWS S3 static deployment in `WebsitePublishListener`
- [ ] Route 53 subdomain auto-provisioning
- [ ] CDN invalidation on re-publish
