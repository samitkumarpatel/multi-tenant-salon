# API Reference

Base path: `/api`

All request and response bodies are `application/json`. Saloon IDs are `UUID` strings. Service, staff, and booking IDs are `Long` integers.

---

## Path Namespace Overview

| Namespace | Base Path | Audience |
|---|---|---|
| **Saloon Onboarding** | `/api/saloon-onboarding` | New tenant registration; platform-level listing |
| **Customer** | `/api/saloon/{saloonId}/...` | Public/customer-facing — browse, book, read |
| **Admin** | `/api/saloon-admin/{saloonId}/...` | Saloon owner/administrator — manage, configure, operate |
| **Utility** | `/api/saloon-utility/...` | Any consumer needing reference data (countries with embedded currency info) |

Customer sub-paths: `/services/...`, `/staff/...`, `/booking/...`, `/website`

Admin sub-paths: `/services/...`, `/staff/...`, `/booking/...`, `/closures`, `/website`, `/website/publish`, `/website-type`, `/features`

---

## Saloon Onboarding

### Register a new saloon

`POST /api/saloon-onboarding`

**Request**

```json
{
  "name": "Glam Saloon",
  "ownerName": "Jane Doe",
  "ownerEmail": "jane@glamsaloon.com",
  "ownerPhone": "+1234567890",
  "location": {
    "address": "123 Main St",
    "city": "New York",
    "state": "NY",
    "country": "USA",
    "zipCode": "10001"
  },
  "contact": {
    "phone": "+1234567890",
    "email": "info@glamsaloon.com",
    "website": "https://glamsaloon.com"
  },
  "operatingHours": [
    { "day": "MONDAY", "openTime": "09:00", "closeTime": "18:00", "closed": false },
    { "day": "SUNDAY", "openTime": null, "closeTime": null, "closed": true }
  ],
  "features": ["BOOKING", "STATIC_WEBSITE"]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | |
| `ownerName` | string | yes | |
| `ownerEmail` | string | yes | |
| `ownerPhone` | string | no | |
| `location` | object | no | See [Location](#location) |
| `contact` | object | no | See [ContactInfo](#contactinfo) |
| `operatingHours` | array | no | See [OperatingHours](#operatinghours) |
| `features` | array | no | See [SaloonFeature](#saloonfeature) values |

**Response** `201 Created`

`Location` header points to the new resource, e.g. `/api/saloon/a1b2c3d4-e5f6-7890-abcd-ef1234567890`.

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "handler": "glam-saloon"
}
```

The `handler` is derived from the saloon name: lowercased, spaces replaced with `-`, special characters stripped. Duplicate base handlers get a numeric suffix (`"glam-saloon"` → `"glam-saloon-2"`, etc.).

**Flow**

1. `SaloonController.create()` validates `@NotBlank` on `name`, `ownerName`, `ownerEmail` — returns `400` before reaching the service if any are blank.
2. `SaloonService.create()` calls `deriveUniqueHandler(name)`: checks `SaloonRepository.existsByHandler(base)` and increments a suffix until a free handler is found. Builds a `Saloon` with `id = null`.
3. `SaloonRepository.save(Saloon)` → **DB**: `INSERT INTO saloon`, `INSERT INTO saloon_operating_hours`, `INSERT INTO saloon_feature` — all in one transaction. Database assigns UUID via `DEFAULT gen_random_uuid()`.
4. `ApplicationEventPublisher.publishEvent(SaloonCreatedEvent)` — Spring Modulith writes the event to `event_publication` before the transaction commits.
5. Returns `201 Created` with `CreateSaloonResponse(id, handler)` and a `Location` header.
6. After commit → **Events** (async):
   - `SaloonNotificationListener.onSaloonCreated(SaloonCreatedEvent)` logs the registration notice.
   - `OwnerStaffListener.onSaloonCreated(SaloonCreatedEvent)` auto-creates a `StaffMember` for the owner (`isOwner = true`, `role = MANAGER`, `status = ACTIVE`, `availableForBooking = true`).

---

### List all saloons (platform view)

`GET /api/saloon-onboarding`

**Response** `200 OK`

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Glam Saloon",
    "handler": "glam-saloon",
    "owner": { "name": "Jane Doe", "email": "jane@glamsaloon.com", "phone": "+1234567890" },
    "location": { "address": "123 Main St", "city": "New York", "state": "NY", "country": "USA", "zipCode": "10001" },
    "contact": { "phone": "+1234567890", "email": "info@glamsaloon.com", "website": "https://glamsaloon.com" },
    "operatingHours": [],
    "features": ["BOOKING"],
    "createdAt": "2026-07-08T10:00:00Z"
  }
]
```

**Flow**

1. `SaloonController.findAll()` → `SaloonService.findAll()` → `SaloonRepository.findAll()`
2. **DB**: `SELECT * FROM saloon` + child rows from `saloon_operating_hours` and `saloon_feature`. `@Embedded` columns are hydrated into `Owner`, `Location`, and `ContactInfo`.
3. Returns `List<Saloon>` — empty array if no saloons exist.

---

## Customer — Saloon Discovery

### Get a saloon

`GET /api/saloon/{saloonIdOrHandler}`

Accepts either a UUID (`a1b2c3d4-e5f6-7890-abcd-ef1234567890`) or a handler slug (`glam-saloon`).

**Response** `200 OK` — full saloon object (includes `id`, `name`, `handler`, `owner`, `location`, `contact`, `operatingHours`, `features`, `createdAt`)

**Response** `404 Not Found` — if neither a saloon with that UUID nor a handler matches

**Flow**

1. `SaloonController.findByIdOrHandler(String)` → `SaloonService.findByIdOrHandler(String)`
2. Tries `UUID.fromString(id)` → `SaloonRepository.findById(UUID)` on success.
3. Falls back to `SaloonRepository.findByHandler(id)` when the value is not a valid UUID.
4. **DB**: `SELECT * FROM saloon WHERE id = ?` or `SELECT * FROM saloon WHERE handler = ?` + child collections.
5. Maps `Optional<Saloon>` → `200 OK` or `404 Not Found`.

---

## Customer — Services

### List services

`GET /api/saloon/{saloonId}/services`

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "saloonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Classic Haircut",
    "description": "Shampoo, cut, and blow-dry",
    "price": 35.00,
    "currency": "USD",
    "durationMinutes": 45,
    "category": "HAIR",
    "active": true,
    "assignedStaffIds": ["1", "2"],
    "createdAt": "2026-07-08T10:00:00Z"
  },
  {
    "id": 2,
    "saloonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Pay as you go",
    "description": "Haircut, Coloring, Facial and more",
    "price": null,
    "currency": null,
    "durationMinutes": null,
    "category": "OTHER",
    "active": true,
    "assignedStaffIds": [],
    "createdAt": "2026-07-08T10:00:00Z"
  }
]
```

> **Pay-as-you-go services**: `price` and `currency` are `null` when no fixed price is set. `durationMinutes` is `null` when not specified — the UI defaults to displaying 30 min and the slot engine uses 30 min for availability calculations.

**Flow**

1. `SaloonServiceController.findAll(UUID)` → `SaloonServiceManager.findBySaloonId(UUID)` → `SaloonServiceRepository.findBySaloonId(UUID)`
2. **DB**: `SELECT * FROM service_item WHERE saloon_id = ?` + `service_item_assigned_staff` rows per item.
3. Returns `List<ServiceItem>` — empty array if none.

---

### Get a service

`GET /api/saloon/{saloonId}/services/{serviceId}`

**Response** `200 OK` — service object

**Response** `404 Not Found` — if the service does not exist or does not belong to the saloon

**Flow**

1. `SaloonServiceController.findById(UUID, Long)` → `SaloonServiceManager.findById(UUID, Long)`
2. `SaloonServiceRepository.findById(Long)` → **DB**: `SELECT * FROM service_item WHERE id = ?`
3. Result is filtered by `saloonId` — returns `404` if not found or saloon mismatch.

---

## Customer — Staff

### List staff

`GET /api/saloon/{saloonId}/staff`

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "saloonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Alice Smith",
    "email": "alice@glamsaloon.com",
    "phone": "+1234567890",
    "role": "STYLIST",
    "status": "ACTIVE",
    "isOwner": false,
    "availableForBooking": true,
    "specializations": ["coloring", "balayage"],
    "photoUrls": ["https://cdn.example.com/staff/alice-1.jpg"],
    "bio": "Alice has 10 years of experience in color and balayage.",
    "createdAt": "2026-07-08T10:00:00Z"
  }
]
```

> **Note**: When a saloon is first created, the owner is automatically enrolled as a staff member with `isOwner = true` and `availableForBooking = true`.

**Flow**

1. `StaffController.findAll(UUID)` → `StaffService.findBySaloonId(UUID)` → `StaffRepository.findBySaloonId(UUID)`
2. **DB**: `SELECT * FROM staff_member WHERE saloon_id = ?` + `staff_member_specialization` rows per member.
3. Returns `List<StaffMember>` — empty array if none.

---

### Get a staff member

`GET /api/saloon/{saloonId}/staff/{staffId}`

**Response** `200 OK` — staff member object

**Response** `404 Not Found` — if the staff member does not exist or does not belong to the saloon

**Flow**

1. `StaffController.findById(UUID, Long)` → `StaffService.findById(UUID, Long)`
2. `StaffRepository.findById(Long)` → **DB**: `SELECT * FROM staff_member WHERE id = ?`
3. Filtered by `saloonId` — returns `404` if not found or saloon mismatch.

---

## Customer — Booking

### Get booking slots

`GET /api/saloon/{saloonId}/booking/slots?serviceId={serviceId}&date={date}[&staffId={staffId}]`

Returns **all** slots within each eligible staff member's working window — both available and already-booked ones. The `booked` flag tells the UI how to render each slot.

**Response** `200 OK`

```json
[
  { "staffId": 1, "startTime": "09:00", "endTime": "09:45", "booked": true },
  { "staffId": 1, "startTime": "10:00", "endTime": "10:45", "booked": false },
  { "staffId": 1, "startTime": "11:00", "endTime": "11:45", "booked": false }
]
```

| Field | Type | Notes |
|---|---|---|
| `staffId` | long | Staff member this slot belongs to |
| `startTime` | time (`HH:mm:ss`) | Slot start time |
| `endTime` | time (`HH:mm:ss`) | Slot end time (start + service duration) |
| `booked` | boolean | `true` = occupied by an existing booking — show grayed-out, non-selectable. `false` = open and bookable. |

**Query Parameters**

| Name | Type | Required | Notes |
|---|---|---|---|
| `serviceId` | long | yes | Determines slot duration |
| `date` | date (`YYYY-MM-DD`) | yes | The appointment date |
| `staffId` | long | no | Filter to a single staff member |

**Flow**

1. `BookingController.getAvailableSlots(UUID, serviceId, date, staffId?)` → `BookingService.findAvailableSlots(...)`
2. Fetches the service for duration, then for each eligible (active + `availableForBooking`) staff member resolves the effective schedule for the date (override takes precedence over weekly schedule).
3. Generates candidate slots at service-duration intervals. Each slot is checked against existing non-cancelled bookings: conflicting slots are included with `booked = true`; open slots carry `booked = false`.
4. Returns `List<AvailableSlot>` sorted by `startTime` then `staffId` — empty if the staff member has no schedule on that date.

---

### Create a booking

`POST /api/saloon/{saloonId}/booking`

**Request**

```json
{
  "serviceId": 1,
  "staffId": 1,
  "customerName": "Bob Smith",
  "customerEmail": "bob@example.com",
  "customerPhone": "+1987654321",
  "appointmentDate": "2026-08-01",
  "startTime": "10:00",
  "notes": "First visit"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `serviceId` | long | yes | |
| `staffId` | long | no | Auto-assigned if omitted |
| `customerName` | string | yes | |
| `customerEmail` | string | yes | |
| `customerPhone` | string | no | |
| `appointmentDate` | date | yes | |
| `startTime` | time | yes | |
| `notes` | string | no | |

**Response** `201 Created` — booking object (status = `PENDING`)

**Response** `404 Not Found` — saloon or service not found

**Response** `409 Conflict` — requested slot is no longer available

**Flow**

1. `BookingController.create(UUID, CreateBookingRequest)` → `BookingService.create(...)`
2. Validates the slot is still free. Calculates `endTime` from service `durationMinutes`. Sets `status = PENDING`.
3. `BookingRepository.save(Booking)` → **DB**: `INSERT INTO booking`.
4. `ApplicationEventPublisher.publishEvent(BookingCreatedEvent)` → Spring Modulith persists the event before commit.
5. Returns `201 Created`.
6. After commit → **Event**: `BookingNotificationListener` logs the booking confirmation.

---

### Get a booking

`GET /api/saloon/{saloonId}/booking/{bookingId}`

**Response** `200 OK` — booking object

**Response** `404 Not Found`

---

## Customer — Website

### Get website theme

`GET /api/saloon/{saloonId}/website`

**Response** `200 OK`

```json
{
  "saloonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "heroBg": "#0F172A",
  "heroTextColor": "#FFFFFF",
  "accentColor": "#F59E0B",
  "fontFamily": "inter",
  "logoBgColor": "#F59E0B",
  "headerBg": "#0F172A",
  "footerBg": "#0F172A",
  "mapsUrl": null,
  "websiteType": "STATIC_WEBSITE",
  "updatedAt": null
}
```

`updatedAt` is `null` when the theme has never been explicitly saved (defaults are returned in-memory). `mapsUrl` is `null` until the admin sets a Google Maps embed URL.

**Flow**

1. `WebsiteController.getTheme(UUID)` → `WebsiteThemeService.getTheme(UUID)` → `WebsiteThemeRepository.findById(UUID)`
2. **DB**: `SELECT * FROM saloon_website_theme WHERE saloon_id = ?`
3. If no row exists, returns a hard-coded default `WebsiteTheme` (no DB write): `heroBg="#0F172A"`, `heroTextColor="#FFFFFF"`, `accentColor="#F59E0B"`, `fontFamily="inter"`, `logoBgColor="#F59E0B"`, `updatedAt=null`.

---

## Admin — Saloon Management

### Get saloon (admin)

`GET /api/saloon-admin/{saloonId}`

**Response** `200 OK` — same saloon object shape as the customer endpoint

**Response** `404 Not Found`

---

### Update saloon details

`PUT /api/saloon-admin/{saloonId}`

Updates name, location, contact, and operating hours. Owner, handler, and features are preserved.

**Request**

```json
{
  "name": "Glam Saloon Uptown",
  "location": {
    "address": "456 Park Ave",
    "city": "New York",
    "state": "NY",
    "country": "USA",
    "zipCode": "10022"
  },
  "contact": {
    "phone": "+1987654321",
    "email": "uptown@glamsaloon.com",
    "website": "https://glamsaloon.com/uptown"
  },
  "operatingHours": [
    { "day": "MONDAY", "openTime": "10:00", "closeTime": "20:00", "closed": false }
  ]
}
```

**Response** `200 OK` — updated saloon object

**Response** `404 Not Found`

**Flow**

1. `SaloonController.update(UUID, UpdateSaloonRequest)` → `SaloonService.update(UUID, ...)`
2. `SaloonRepository.findById(UUID)` → `404` if empty.
3. Builds a new `Saloon` record preserving `id`, `handler`, `owner`, `features`, `createdAt`; replacing `name`, `location`, `contact`, `operatingHours`.
4. `SaloonRepository.save(Saloon)` → **DB**: `UPDATE saloon SET ...` + `DELETE FROM saloon_operating_hours WHERE saloon_id = ?` + re-`INSERT`.
5. Returns `200 OK`.

---

### Replace saloon features

`PUT /api/saloon-admin/{saloonId}/features`

Replaces the full feature list for a saloon.

**Request**

```json
["BOOKING", "MEMBERSHIP", "WEBSHOP"]
```

**Response** `200 OK` — updated saloon object

**Response** `404 Not Found`

**Flow**

1. `SaloonController.updateFeatures(UUID, List<SaloonFeature>)` → `SaloonService.updateFeatures(UUID, ...)`
2. `SaloonRepository.findById(UUID)` → `404` if empty.
3. Builds a new `Saloon` preserving all fields except `features`.
4. `SaloonRepository.save(Saloon)` → **DB**: `DELETE FROM saloon_feature WHERE saloon_id = ?` + re-`INSERT`.
5. Returns `200 OK`.

---

### Delete a saloon

`DELETE /api/saloon-admin/{saloonId}`

**Response** `204 No Content`

**Flow**

1. `SaloonController.delete(UUID)` → `SaloonService.delete(UUID)` → `SaloonRepository.deleteById(UUID)`
2. **DB**: `DELETE FROM saloon WHERE id = ?` — `ON DELETE CASCADE` removes rows in `saloon_operating_hours`, `saloon_feature`, `service_item`, and `staff_member` automatically.
3. Always returns `204` — no-op if the UUID does not exist.

---

## Admin — Website

### Get website theme (admin)

`GET /api/saloon-admin/{saloonId}/website`

Same response shape as the public endpoint — includes all theme fields plus `websiteType`. See [Get website theme](#get-website-theme).

---

### Save website theme

`PUT /api/saloon-admin/{saloonId}/website`

Creates or fully replaces the theme (`ON CONFLICT DO UPDATE`).

**Request**

```json
{
  "heroBg": "#1E293B",
  "heroTextColor": "#F8FAFC",
  "accentColor": "#6366F1",
  "fontFamily": "poppins",
  "logoBgColor": "#6366F1",
  "headerBg": "#0F172A",
  "footerBg": "#0F172A",
  "mapsUrl": "https://www.google.com/maps/embed?pb=..."
}
```

| Field | Type | Notes |
|---|---|---|
| `heroBg` | string | CSS color for the hero section background |
| `heroTextColor` | string | CSS color for hero text |
| `accentColor` | string | Primary accent / CTA color |
| `fontFamily` | string | Font family slug (e.g. `"inter"`, `"poppins"`) |
| `logoBgColor` | string | Background color behind the saloon logo |
| `headerBg` | string | Navigation bar background color |
| `footerBg` | string | Footer background color |
| `mapsUrl` | string | Google Maps embed URL for the saloon location |

**Response** `200 OK`

```json
{
  "saloonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "heroBg": "#1E293B",
  "heroTextColor": "#F8FAFC",
  "accentColor": "#6366F1",
  "fontFamily": "poppins",
  "logoBgColor": "#6366F1",
  "headerBg": "#0F172A",
  "footerBg": "#0F172A",
  "mapsUrl": "https://www.google.com/maps/embed?pb=...",
  "websiteType": "STATIC_WEBSITE",
  "updatedAt": "2026-07-08T12:00:00Z"
}
```

**Flow**

1. `WebsiteController.saveTheme(UUID, SaveThemeRequest)` → `WebsiteThemeService.saveTheme(UUID, ...)`
2. **DB**: `INSERT INTO saloon_website_theme (...) ON CONFLICT (saloon_id) DO UPDATE SET ...` with `updated_at = NOW()`.
3. Re-fetches the persisted row and returns `200 OK`.

---

### Get website type (admin)

`GET /api/saloon-admin/{saloonId}/website-type`

Returns only the current website presentation type. Defaults to `STATIC_WEBSITE` if the theme row does not yet exist. This endpoint is called when the admin navigates to the website tab.

**Response** `200 OK`

```json
{ "websiteType": "STATIC_WEBSITE" }
```

**Flow**

1. `WebsiteController.getWebsiteType(UUID)` → `WebsiteThemeService.getWebsiteType(UUID)`
2. `WebsiteThemeRepository.findById(UUID)` → maps `websiteType`; returns `STATIC_WEBSITE` if no row.
3. Returns `WebsiteTypeResponse`.

---

### Update website type (admin)

`PATCH /api/saloon-admin/{saloonId}/website-type`

Updates the website presentation type. The rest of the theme is preserved. Creates the theme row if it does not yet exist.

**Request**

```json
{ "websiteType": "STATIC_WEBSITE" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `websiteType` | string | yes | One of `STATIC_WEBSITE`, `GENERATIVE_UI`, `CUSTOMISE_WEBSITE_CONTACT_US` |

**Response** `200 OK` — updated `WebsiteTheme` object

**Response** `404 Not Found`

**Flow**

1. `WebsiteController.updateWebsiteType(UUID, WebsiteTypeRequest)` → `WebsiteThemeService.updateWebsiteType(UUID, WebsiteType)`
2. Upserts the row updating only the `website_mode` column.
3. Returns the full updated `WebsiteTheme`.

---

### Publish website

`POST /api/saloon-admin/{saloonId}/website/publish`

Triggers an asynchronous website deployment pipeline. The saloon must have the `STATIC_WEBSITE` feature enabled. Returns immediately; actual work (S3 deploy, subdomain, DNS) is handled asynchronously by the `website` module.

**Response** `202 Accepted`

**Response** `404 Not Found`

**Response** `422 Unprocessable Entity` — saloon does not have `STATIC_WEBSITE` feature enabled

**Flow**

1. `SaloonController.publishWebsite(UUID)` → `SaloonService.publishWebsite(UUID)`
2. `SaloonRepository.findById(UUID)` — `404` if not found.
3. Checks `saloon.features()` for `STATIC_WEBSITE` — `422` if absent.
4. `ApplicationEventPublisher.publishEvent(WebsitePublishRequestedEvent)` — Spring Modulith writes the event to `event_publication` before commit.
5. Returns `202 Accepted`.
6. After commit → **Event**: `WebsitePublishListener.onWebsitePublishRequested(...)` invoked asynchronously. Currently logs the intent; AWS pipeline integration is pending.

---

## Admin — Services

### List services (admin)

`GET /api/saloon-admin/{saloonId}/services`

Same response as the public endpoint. See [List services](#list-services).

---

### Add a service

`POST /api/saloon-admin/{saloonId}/services`

**Request**

```json
{
  "name": "Classic Haircut",
  "description": "Shampoo, cut, and blow-dry",
  "price": 35.00,
  "currency": "USD",
  "durationMinutes": 45,
  "category": "HAIR",
  "assignedStaffIds": ["1", "2"]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | |
| `description` | string | no | |
| `price` | decimal\|null | no | Omit or send `null` for pay-as-you-go |
| `currency` | string\|null | no | ISO 4217, e.g. `"USD"`; `null` when `price` is `null` |
| `durationMinutes` | int\|null | no | Omit or send `null` for pay-as-you-go; defaults to 30 min in the UI and slot engine |
| `category` | string | yes | See [ServiceCategory](#servicecategory) values |
| `assignedStaffIds` | array | no | IDs of staff members to assign |

**Response** `201 Created` — service object

`Location` header: `/api/saloon/{saloonId}/services/{serviceId}`

**Flow**

1. `SaloonServiceController.add(UUID, AddServiceRequest)` → `SaloonServiceManager.add(UUID, ...)`
2. Builds a `ServiceItem` with `id = null`, `active = true`, `createdAt = Instant.now()`.
3. `SaloonServiceRepository.save(ServiceItem)` → **DB**: `INSERT INTO service_item` + `INSERT INTO service_item_assigned_staff`.
4. Returns `201 Created` with the saved `ServiceItem` and a `Location` header.

---

### Get a service (admin)

`GET /api/saloon-admin/{saloonId}/services/{serviceId}`

**Response** `200 OK` — service object

**Response** `404 Not Found`

---

### Update a service

`PUT /api/saloon-admin/{saloonId}/services/{serviceId}`

**Request**

```json
{
  "name": "Premium Haircut",
  "description": "Shampoo, cut, blow-dry, and styling",
  "price": 55.00,
  "currency": "USD",
  "durationMinutes": 60,
  "category": "HAIR",
  "active": true,
  "assignedStaffIds": ["1"]
}
```

**Response** `200 OK` — updated service object

**Response** `404 Not Found`

**Flow**

1. `SaloonServiceController.update(UUID, Long, UpdateServiceRequest)` → `SaloonServiceManager.update(...)`
2. `SaloonServiceRepository.findById(Long)` — filtered by `saloonId`, `404` on mismatch.
3. Builds a new `ServiceItem` preserving `id`, `saloonId`, `createdAt`.
4. `SaloonServiceRepository.save(ServiceItem)` → **DB**: `UPDATE service_item SET ...` + `DELETE FROM service_item_assigned_staff WHERE service_item_id = ?` + re-`INSERT`.
5. Returns `200 OK`.

---

### Delete a service

`DELETE /api/saloon-admin/{saloonId}/services/{serviceId}`

**Response** `204 No Content`

**Flow**

1. `SaloonServiceController.remove(UUID, Long)` → `SaloonServiceManager.remove(UUID, Long)`
2. `SaloonServiceRepository.findById(Long)` — filtered by `saloonId`. Skips silently if not found or wrong saloon.
3. `SaloonServiceRepository.deleteById(Long)` → **DB**: `DELETE FROM service_item WHERE id = ?` — cascade removes `service_item_assigned_staff` rows.
4. Always returns `204`.

---

## Admin — Staff

### List staff (admin)

`GET /api/saloon-admin/{saloonId}/staff`

Same response as the public endpoint. See [List staff](#list-staff).

---

### Onboard a staff member

`POST /api/saloon-admin/{saloonId}/staff`

**Request**

```json
{
  "name": "Alice Smith",
  "email": "alice@glamsaloon.com",
  "phone": "+1234567890",
  "role": "STYLIST",
  "specializations": ["coloring", "balayage"],
  "photoUrls": ["https://cdn.example.com/staff/alice-1.jpg"],
  "bio": "Alice has 10 years of experience in color and balayage."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | |
| `email` | string | no | |
| `phone` | string | no | |
| `role` | string | yes | See [StaffRole](#staffrole) values |
| `specializations` | array | no | Free-text strings |
| `photoUrls` | array | no | Photo URLs shown on the public website |
| `bio` | string | no | Short bio shown on the public website |

New staff members are set to `status = ACTIVE` automatically.

**Response** `201 Created` — staff member object

`Location` header: `/api/saloon/{saloonId}/staff/{staffId}`

**Flow**

1. `StaffController.onboard(UUID, OnboardRequest)` → `StaffService.onboard(UUID, ...)`
2. Builds a `StaffMember` with `id = null`, `status = ACTIVE`, `createdAt = Instant.now()`.
3. `StaffRepository.save(StaffMember)` → **DB**: `INSERT INTO staff_member` + `INSERT INTO staff_member_specialization`.
4. Returns `201 Created`.

---

### Get a staff member (admin)

`GET /api/saloon-admin/{saloonId}/staff/{staffId}`

**Response** `200 OK` — staff member object

**Response** `404 Not Found`

---

### Update a staff member

`PUT /api/saloon-admin/{saloonId}/staff/{staffId}`

**Request**

```json
{
  "name": "Alice Smith",
  "email": "alice@glamsaloon.com",
  "phone": "+1234567890",
  "role": "COLORIST",
  "status": "ON_LEAVE",
  "availableForBooking": false,
  "specializations": ["coloring", "balayage", "highlights"],
  "photoUrls": ["https://cdn.example.com/staff/alice-1.jpg"],
  "bio": "Alice has 10 years of experience in color and balayage."
}
```

Setting `availableForBooking` to `false` removes the staff member from slot discovery — customers will not be able to book appointments with them.

**Response** `200 OK` — updated staff member object

**Response** `404 Not Found`

**Flow**

1. `StaffController.update(UUID, Long, UpdateRequest)` → `StaffService.update(UUID, Long, ...)`
2. `StaffRepository.findById(Long)` — filtered by `saloonId`, `404` on mismatch.
3. Builds a new `StaffMember` preserving `id`, `saloonId`, `createdAt` — all other fields are replaced.
4. `StaffRepository.save(StaffMember)` → **DB**: `UPDATE staff_member SET ...` + `DELETE FROM staff_member_specialization WHERE staff_member_id = ?` + re-`INSERT`.
5. Returns `200 OK`.

---

### Remove a staff member

`DELETE /api/saloon-admin/{saloonId}/staff/{staffId}`

**Response** `204 No Content`

**Flow**

1. `StaffController.remove(UUID, Long)` → `StaffService.remove(UUID, Long)`
2. `StaffRepository.findById(Long)` — filtered by `saloonId`. Skips silently if not found or wrong saloon.
3. `StaffRepository.deleteById(Long)` → **DB**: `DELETE FROM staff_member WHERE id = ?` — cascade removes `staff_member_specialization` rows.
4. Always returns `204`.

---

## Admin — Staff Availability

### Get weekly availability schedule

`GET /api/saloon-admin/{saloonId}/staff/{staffId}/availability`

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "saloonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "staffId": 1,
    "dayOfWeek": "MONDAY",
    "startTime": "09:00",
    "endTime": "17:00",
    "available": true
  }
]
```

---

### Replace weekly availability schedule

`PUT /api/saloon-admin/{saloonId}/staff/{staffId}/availability`

**Request**

```json
[
  { "dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true },
  { "dayOfWeek": "TUESDAY", "startTime": "09:00", "endTime": "17:00", "available": true },
  { "dayOfWeek": "SUNDAY", "startTime": null, "endTime": null, "available": false }
]
```

Previous entries are deleted before the new set is saved. Emits **StaffScheduleUpdatedEvent**.

**Response** `200 OK` — updated availability entries

---

### List date-specific overrides

`GET /api/saloon-admin/{saloonId}/staff/{staffId}/availability/overrides`

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "saloonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "staffId": 1,
    "overrideDate": "2026-12-25",
    "startTime": null,
    "endTime": null,
    "available": false,
    "reason": "Public holiday"
  }
]
```

---

### Add a date-specific override

`POST /api/saloon-admin/{saloonId}/staff/{staffId}/availability/overrides`

**Request**

```json
{
  "overrideDate": "2026-12-25",
  "available": false,
  "reason": "Public holiday"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `overrideDate` | date | yes | Specific date to override |
| `startTime` | time | no | null when `available: false` |
| `endTime` | time | no | null when `available: false` |
| `available` | boolean | yes | |
| `reason` | string | no | |

Emits **StaffAvailabilityOverrideAddedEvent**.

**Response** `201 Created` — override object

---

### Remove a date-specific override

`DELETE /api/saloon-admin/{saloonId}/staff/{staffId}/availability/overrides/{overrideId}`

Deletes the override so the regular weekly schedule applies again for that date.
Emits **StaffAvailabilityOverrideRemovedEvent**.

**Response** `204 No Content`

---

## Customer — Closures (read-only)

`GET /api/saloon/{saloonId}/closures`

Returns all closures for the saloon. Used by the booking wizard to disable closed date ranges in the calendar (month, week, and designer views).

**Response** `200 OK` — array of `SaloonClosure` (same schema as admin endpoint below).

---

## Admin — Closures

Saloon closures block the entire saloon on a date range (vacation, public holiday, emergency). When a date falls within a closure:
- `GET .../slots` returns an **empty array**
- `POST .../booking` returns **HTTP 400**
- Booking calendar views visually disable those dates

### List closures

`GET /api/saloon-admin/{saloonId}/closures`

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "saloonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "startDate": "2026-08-04",
    "endDate": "2026-08-15",
    "reason": "Annual vacation"
  },
  {
    "id": 2,
    "saloonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "startDate": "2026-12-25",
    "endDate": "2026-12-25",
    "reason": "Christmas Day"
  }
]
```

---

### Add a closure

`POST /api/saloon-admin/{saloonId}/closures`

**Request**

```json
{
  "startDate": "2026-08-04",
  "endDate": "2026-08-15",
  "reason": "Annual vacation"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `startDate` | date | yes | First day of the closure, `YYYY-MM-DD` |
| `endDate` | date | yes | Last day (inclusive); same as `startDate` for a single-day closure |
| `reason` | string | no | Human-readable reason shown in admin UI |

**Response** `200 OK` — the created `SaloonClosure` object

---

### Remove a closure

`DELETE /api/saloon-admin/{saloonId}/closures/{closureId}`

**Response** `204 No Content`

---

## Admin — Booking

### List all bookings

`GET /api/saloon-admin/{saloonId}/booking`

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "saloonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "serviceId": 1,
    "staffId": 1,
    "customerName": "Bob Smith",
    "customerEmail": "bob@example.com",
    "customerPhone": "+1987654321",
    "appointmentDate": "2026-08-01",
    "startTime": "10:00",
    "endTime": "10:45",
    "status": "PENDING",
    "notes": "First visit",
    "createdAt": "2026-07-08T10:00:00Z"
  }
]
```

---

### Get a booking (admin)

`GET /api/saloon-admin/{saloonId}/booking/{bookingId}`

**Response** `200 OK` — booking object

**Response** `404 Not Found`

---

### Reschedule a booking

`PUT /api/saloon-admin/{saloonId}/booking/{bookingId}`

Moves a booking to a different date, time, or staff member. End time is recalculated automatically.
Emits **BookingRescheduledEvent**.

**Request**

```json
{
  "appointmentDate": "2026-08-05",
  "startTime": "14:00",
  "staffId": 2,
  "notes": "Rescheduled due to staff unavailability"
}
```

**Response** `200 OK` — updated booking object

**Response** `404 Not Found`

---

### Delete a booking

`DELETE /api/saloon-admin/{saloonId}/booking/{bookingId}`

**Response** `204 No Content`

---

### Confirm a booking

`POST /api/saloon-admin/{saloonId}/booking/{bookingId}/confirm`

Moves the booking from `PENDING` to `CONFIRMED`. Emits **BookingStatusChangedEvent**.

**Response** `200 OK` — updated booking object

**Response** `404 Not Found`

---

### Cancel a booking

`POST /api/saloon-admin/{saloonId}/booking/{bookingId}/cancel`

Moves the booking to `CANCELLED`. Emits **BookingStatusChangedEvent**.

**Response** `200 OK` — updated booking object

**Response** `404 Not Found`

---

### Complete a booking

`POST /api/saloon-admin/{saloonId}/booking/{bookingId}/complete`

Marks the appointment as `COMPLETED` after the customer's visit. Emits **BookingStatusChangedEvent**.

**Response** `200 OK` — updated booking object

**Response** `404 Not Found`

---

### Mark booking as no-show

`POST /api/saloon-admin/{saloonId}/booking/{bookingId}/no-show`

Records that the customer did not attend. Emits **BookingStatusChangedEvent**.

**Response** `200 OK` — updated booking object

**Response** `404 Not Found`

---

## Utility

### List countries

`GET /api/saloon-utility/countries`

Returns the full list of countries with their ISO codes, dial codes, and embedded currency info. Data is loaded and joined from static classpath resources at startup — no database access occurs on this endpoint.

**Response** `200 OK`

```json
[
  { "name": "United States", "code": "US", "dialCode": "+1",  "currencyCode": "USD", "currencyName": "United States Dollar", "currencySymbol": "$"  },
  { "name": "India",         "code": "IN", "dialCode": "+91", "currencyCode": "INR", "currencyName": "Indian Rupee",         "currencySymbol": "₹" }
]
```

| Field | Type | Notes |
|---|---|---|
| `name` | string | Full country name |
| `code` | string | ISO 3166-1 alpha-2 code |
| `dialCode` | string | International dialling prefix (e.g. `"+1"`) |
| `currencyCode` | string | ISO 4217 currency code (e.g. `"USD"`) |
| `currencyName` | string | Full currency name (e.g. `"United States Dollar"`) |
| `currencySymbol` | string | Currency symbol (e.g. `"$"`) |

**Flow**

1. `UtilityController.countries()` → `CountryService.findAll()`
2. `CountryService` loads countries from `${spring.application.utility.static-geo-data}` and currencies from `${spring.application.utility.static-currency-data}` at startup, joining them by `currencyCode`; subsequent calls read from the in-memory list.
3. Returns `List<Country>`.

---

## Reference

### WebsiteType

| Value | Description |
|---|---|
| `STATIC_WEBSITE` | Clean, customisable static page — services, team, hours, contact (default) |
| `GENERATIVE_UI` | AI-generated personalised page per visitor, powered by MCP |
| `CUSTOMISE_WEBSITE_CONTACT_US` | Bespoke website built to a custom design brief |

### SaloonFeature

| Value | Description |
|---|---|
| `STATIC_WEBSITE` | Public-facing website for the saloon |
| `BOOKING` | Online appointment booking |
| `MEMBERSHIP` | Customer membership / subscription plans |
| `WEBSHOP` | Online product shop |
| `ANALYTICS` | Business analytics dashboard |
| `LOYALTY_PROGRAM` | Customer loyalty and rewards |

### ServiceCategory

| Value |
|---|
| `HAIR` |
| `MAKEUP` |
| `NAILS` |
| `SKIN_CARE` |
| `BEARD` |
| `MASSAGE` |
| `WAXING` |
| `OTHER` |

### StaffRole

| Value |
|---|
| `MANAGER` |
| `STYLIST` |
| `COLORIST` |
| `MAKEUP_ARTIST` |
| `NAIL_TECHNICIAN` |
| `RECEPTIONIST` |
| `ASSISTANT` |

### StaffStatus

| Value |
|---|
| `ACTIVE` |
| `INACTIVE` |
| `ON_LEAVE` |

### BookingStatus

| Value | Description |
|---|---|
| `PENDING` | Booking created, awaiting admin confirmation |
| `CONFIRMED` | Admin confirmed the appointment |
| `CANCELLED` | Booking cancelled |
| `COMPLETED` | Appointment successfully completed |
| `NO_SHOW` | Customer did not attend |

### Location

| Field | Type |
|---|---|
| `address` | string |
| `city` | string |
| `state` | string |
| `country` | string |
| `zipCode` | string |

### ContactInfo

| Field | Type |
|---|---|
| `phone` | string |
| `email` | string |
| `website` | string |

### OperatingHours

| Field | Type | Notes |
|---|---|---|
| `day` | string | `MONDAY` – `SUNDAY` |
| `openTime` | string | `"HH:mm"`, null if `closed` is true |
| `closeTime` | string | `"HH:mm"`, null if `closed` is true |
| `closed` | boolean | |
