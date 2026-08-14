# Salon SaaS Platform — Architecture

Architecture diagram: [`others/salon_saas_architecture.svg`](../others/salon_saas_architecture.svg)

---

## Overview

A **multi-tenant SaaS platform** for salon/salon management. Each salon is a tenant. The platform is composed of four microfrontend applications backed by a single **Spring Modulith** backend.

---

## Frontend — Microfrontend Layer (Module Federation)

All four apps are independently deployable microfrontends wired together with Webpack Module Federation (or equivalent). They share a common design system and auth token but can be developed, tested, and deployed independently.

| App | Audience | Responsibilities |
|-----|----------|-----------------|
| **salon-onboarding** | New salon owners | Registration wizard, initial setup, handler selection |
| **salon-public-website** | End customers | Booking flow, service catalog, staff gallery, real-time theme rendering |
| **salon-admin** | Salon owner / manager | Staff management, service catalog, booking calendar, theme editor |
| **salon-super-admin** | Platform operators | Tenant management, platform-wide configuration, billing |

### salon-public-website — special: real-time theming

This app is unique because its visual appearance is controlled at runtime by the salon-admin. When an admin changes the theme (header/footer/hero background colors, accent color, font), the public website reflects those changes **without a deploy**. See the [Real-time Theme Flow](#real-time-theme-update-flow) section below.

---

## Backend — Modulith

A **modular monolith** built with [Spring Modulith](https://docs.spring.io/spring-modulith/reference/). Modules live under `net.samitkumar.multi_tenant_salon` as top-level packages. Module boundaries are enforced at compile-time by Modulith. Cross-module communication uses **Spring Application Events**, never direct bean injection.

### Stack

- Java 25, Spring Boot 4.1, Spring Modulith 2.0.6
- Spring Data JDBC (PostgreSQL)
- Testcontainers for integration tests
- GraalVM Native Image ready

### Modules

#### Business modules

| Module | Package | Responsibilities |
|--------|---------|-----------------|
| **salon** | `salon` | Core aggregate: `Salon` entity, owner/location/contact info, operating hours, features. Publishes `SalonCreatedEvent` and `WebsitePublishRequestedEvent`. |
| **salonservice** | `salonservice` | `ServiceItem` catalog per salon (name, price, duration, category, assigned staff). |
| **staff** | `staff` | `StaffMember` roster per salon (role, status, specializations, availability). Publishes `StaffOnboardedEvent`. |
| **booking** | `booking` | Appointments, available slot calculation, staff availability schedule and overrides. Publishes `BookingCreatedEvent`, `BookingStatusChangedEvent`, `BookingRescheduledEvent`, `StaffScheduleUpdatedEvent`, `StaffAvailabilityOverrideAddedEvent/RemovedEvent`. |
| **website** | `website` | `WebsiteTheme` per salon (colors, font, maps URL, website mode). Listens to `WebsitePublishRequestedEvent`. |

#### Support modules

| Module | Package | Responsibilities |
|--------|---------|-----------------|
| **notification** | `notification` | Listens to booking and salon events; dispatches SMS/email/push. Has **no REST endpoint** — purely event-driven. |
| **utility** | `utility` | Shared reference data (country list). Exposed via `/api/salon-utility/countries`. |

---

## API Route Namespaces

All API routes share the `/api` base prefix. The next path segment determines the owning module and access level:

| Prefix | Used by | Auth | Notes |
|--------|---------|------|-------|
| `/api/salon-onboarding` | salon-onboarding app | Public | `POST /api/salon-onboarding` — creates a new salon tenant |
| `/api/salon/{id-or-handler}/...` | salon-public-website | Public (read-only) | Customer-facing: services, staff, booking slots, website theme |
| `/api/salon-admin/{id}/...` | salon-admin app | Authenticated | All write operations: staff CRUD, service CRUD, booking management, theme, availability |
| `/api/salon-super-admin/...` | salon-super-admin app | Admin auth | Platform-wide tenant management |
| `/api/salon-utility/...` | All apps | Public | Reference data (countries, enums) |

### Endpoint quick-reference

#### Salon onboarding
```
POST   /api/salon-onboarding                           Create new salon
GET    /api/salon-onboarding                           List all salons (admin use)
```

#### Public (customer-facing)
```
GET    /api/salon/{id}                                 Get salon detail
GET    /api/salon/{id}/services                        List services
GET    /api/salon/{id}/services/{serviceId}            Get service
GET    /api/salon/{id}/staff                           List staff
GET    /api/salon/{id}/staff/{staffId}                 Get staff member
GET    /api/salon/{id}/slots?date=&staffId=            Available booking slots
POST   /api/salon/{id}/booking                         Create booking (customer)
GET    /api/salon/{id}/website                         Get website theme
```

#### Salon admin
```
GET/PUT  /api/salon-admin/{id}                         Get/update salon
PUT      /api/salon-admin/{id}/features                Update enabled features
DELETE   /api/salon-admin/{id}                         Delete salon
POST     /api/salon-admin/{id}/website/publish         Trigger website publish

GET/PUT  /api/salon-admin/{id}/website                 Get/update website theme
GET      /api/salon-admin/{id}/website-type            Get website mode
PATCH    /api/salon-admin/{id}/website-type            Update website mode

GET/POST /api/salon-admin/{id}/services                List/create services
GET/PUT/DELETE /api/salon-admin/{id}/services/{svcId}  Manage service

GET/POST /api/salon-admin/{id}/staff                   List/create staff
GET/PUT/DELETE /api/salon-admin/{id}/staff/{staffId}   Manage staff member

GET/PUT  /api/salon-admin/{id}/staff/{staffId}/availability             Weekly schedule
GET/POST /api/salon-admin/{id}/staff/{staffId}/availability/overrides   Date overrides
DELETE   /api/salon-admin/{id}/staff/{staffId}/availability/overrides/{oid}

GET/POST /api/salon-admin/{id}/booking                 List/create bookings
GET/PUT/DELETE /api/salon-admin/{id}/booking/{bookingId} Manage booking
POST     /api/salon-admin/{id}/booking/{bookingId}/confirm
POST     /api/salon-admin/{id}/booking/{bookingId}/cancel
POST     /api/salon-admin/{id}/booking/{bookingId}/complete
POST     /api/salon-admin/{id}/booking/{bookingId}/no-show
GET      /api/salon-admin/{id}/slots                   Available slots (admin view)
```

#### Utility
```
GET    /api/salon-utility/countries                    Country list
```

---

## Spring Application Events

Modules communicate exclusively through Spring Application Events annotated with `@ApplicationModuleListener`. Events are persisted via `spring-modulith-starter-jdbc` before dispatch, guaranteeing at-least-once delivery even across transaction boundaries.

| Event | Publisher | Listeners |
|-------|-----------|-----------|
| `SalonCreatedEvent` | `salon` | `notification` (welcome email), `staff` (auto-create owner staff entry) |
| `WebsitePublishRequestedEvent` | `salon` | `website` (invoke AWS deployment pipeline) |
| `StaffOnboardedEvent` | `staff` | `booking` (initialise default availability schedule) |
| `BookingCreatedEvent` | `booking` | `notification` (confirmation SMS/email) |
| `BookingStatusChangedEvent` | `booking` | `notification` (status update alert) |
| `BookingRescheduledEvent` | `booking` | `notification` |
| `StaffScheduleUpdatedEvent` | `booking` | — (reserved for downstream consumers) |
| `StaffAvailabilityOverrideAddedEvent` | `booking` | — |
| `StaffAvailabilityOverrideRemovedEvent` | `booking` | — |

---

## Real-time Theme Update Flow

The **salon-public-website** can reflect theme changes made in the **salon-admin** instantly — without a redeploy or page reload.

```
salon-admin
  └─ edits header_bg / footer_bg / hero_bg / accent_color / font_family / logo_bg_color
  └─ PUT /api/salon-admin/{id}/website  →  WebsiteThemeService  →  saves to salon_website_theme table

(Optional explicit publish)
  └─ POST /api/salon-admin/{id}/website/publish  →  WebsitePublishRequestedEvent
  └─ WebsitePublishListener  →  deploys static assets to S3, creates Route 53 subdomain

SSE push (planned)
  └─ theme-change event  →  Server-Sent Events endpoint  →  salon-public-website EventSource listener
  └─ re-fetches GET /api/salon/{id}/website  →  re-renders header / footer / hero in-place
```

**Theme fields stored per tenant (`salon_website_theme`):**

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

Each salon is a tenant identified by its `id` (UUID) and `handler` (URL slug). The handler is used as the subdomain key: `{handler}.yourbrand.com`.

| Strategy | When used | Isolation |
|----------|-----------|-----------|
| **Shared DB, row-level isolation** | Default (all tenants) | `tenant_id` / `salon_id` column on every table |
| **Schema-per-tenant DB** | Premium / enterprise tenants | Separate PostgreSQL schema per tenant |

### Caching (Redis)
- Session tokens
- Real-time booking slot availability (short TTL)
- Website theme (to avoid DB reads on every public page load)

---

## Multi-tenancy Resolution

```
Request: GET acmesalon.yourbrand.com/services
  └─ API Gateway extracts subdomain  →  handler = "acmesalon"
  └─ Resolves to salon.id via handler lookup
  └─ All downstream queries scoped to that salon_id
```

Custom domain mapping (`mycustomsalon.com` → handler) is also supported.

---

## Implementation Plan

### Phase 1 — Backend alignment (current)
- [x] `salon` module — core entity, onboarding API
- [x] `salonservice` module — service catalog API
- [x] `staff` module — roster and availability
- [x] `booking` module — appointments, slots, overrides
- [x] `website` module — theme CRUD, publish event
- [x] `notification` module — event listeners (stub)
- [x] `utility` module — countries

### Phase 2 — Microfrontend scaffold
- [ ] Set up Module Federation host shell
- [ ] `salon-onboarding` remote — registration wizard
- [ ] `salon-public-website` remote — customer booking + theme rendering
- [ ] `salon-admin` remote — management dashboard
- [ ] `salon-super-admin` remote — platform ops

### Phase 3 — Real-time theme push
- [ ] Add SSE endpoint: `GET /api/salon/{id}/website/events`
- [ ] Emit theme-change server-sent event on `PUT /api/salon-admin/{id}/website`
- [ ] `salon-public-website` opens `EventSource` and hot-swaps CSS variables on event

### Phase 4 — Website publish pipeline
- [ ] AWS S3 static deployment in `WebsitePublishListener`
- [ ] Route 53 subdomain auto-provisioning
- [ ] CDN invalidation on re-publish
