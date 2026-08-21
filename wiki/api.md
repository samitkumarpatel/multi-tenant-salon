# API Reference

Base path: `/api`

All request and response bodies are `application/json`. Salon IDs are `UUID` strings. Service, staff, and booking IDs are `Long` integers.

---

## Path Namespace Overview

| Namespace | Base Path | Audience |
|---|---|---|
| **Salon Onboarding** | `/api/salon-onboarding` | New tenant registration; platform-level listing |
| **Customer** | `/api/salon/{salonId}/...` | Public/customer-facing — browse, book, read |
| **Admin** | `/api/salon-admin/{salonId}/...` | Salon owner/administrator — manage, configure, operate |
| **Super Admin** | `/api/salon-super-admin/...` | Platform super-admin — cross-tenant management of all salons |
| **Staff Portal** | `/api/salon-staff/...` | Authenticated staff member — self-service profile, appointments, personal holidays |
| **Utility** | `/api/salon-utility/...` | Any consumer needing reference data (countries with embedded currency info) |

Customer sub-paths: `/services/...`, `/staff/...`, `/booking/...`, `/website`

Admin sub-paths: `/services/...`, `/staff/...`, `/booking/...`, `/closures`, `/holidays`, `/booking-settings`, `/website`, `/website-type`, `/features`

---

## Salon Onboarding

### Register a new salon

`POST /api/salon-onboarding`

**Request**

```json
{
  "name": "Glam Salon",
  "ownerName": "Jane Doe",
  "ownerEmail": "jane@glamsalon.com",
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
    "email": "info@glamsalon.com",
    "website": "https://glamsalon.com"
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
| `features` | array | no | See [SalonFeature](#salonfeature) values |
| `businessRegistrationId` | string | no | Business reg. number (e.g. CVR, EIN) shown on the public website |
| `showBusinessId` | boolean | no | Whether to display the registration number publicly; defaults to `false` |
| `termsAccepted` | boolean | **yes** | Must be `true` — the owner explicitly accepted the terms and conditions |

**Response** `201 Created`

`Location` header points to the new resource, e.g. `/api/salon/a1b2c3d4-e5f6-7890-abcd-ef1234567890`.

```json
{
  "salonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "salonHandler": "glam-salon",
  "emailId": "jane@glamsalon.com",
  "message": "Welcome! We've sent a login link and setup guide to jane@glamsalon.com. Use your email to sign in to the admin panel."
}
```

| Field | Type | Description |
|---|---|---|
| `salonId` | UUID | The newly created salon's unique identifier |
| `salonHandler` | string | URL-friendly slug derived from the salon name |
| `emailId` | string | The owner's email to use when signing in to the admin panel |
| `message` | string | Confirmation that a welcome email has been sent |

The `salonHandler` is derived from the salon name: lowercased, spaces replaced with `-`, special characters stripped. Duplicate base handlers get a numeric suffix (`"glam-salon"` → `"glam-salon-2"`, etc.).

**Flow**

1. `SalonController.create()` validates `@NotBlank` on `name`, `ownerName`, `ownerEmail` — returns `400` before reaching the service if any are blank.
2. `SalonService.create()` calls `deriveUniqueHandler(name)`: checks `SalonRepository.existsByHandler(base)` and increments a suffix until a free handler is found. Derives `businessIdLabel` from `location.country` using the countries reference data (e.g. `"Denmark"` → `"CVR Number"`). Builds a `Salon` with `id = null`.
3. `SalonRepository.save(Salon)` → **DB**: `INSERT INTO salon`, `INSERT INTO salon_operating_hours`, `INSERT INTO salon_feature` — all in one transaction. Database assigns UUID via `DEFAULT gen_random_uuid()`.
4. `ApplicationEventPublisher.publishEvent(SalonCreatedEvent)` — Spring Modulith writes the event to `event_publication` before the transaction commits.
5. Returns `201 Created` with `CreateSalonResponse(salonId, salonHandler, emailId, message)` and a `Location` header.
6. After commit → **Events** (async):
   - `SalonNotificationListener.onSalonCreated(SalonCreatedEvent)` logs the registration notice.
   - `OwnerStaffListener.onSalonCreated(SalonCreatedEvent)` auto-creates a `StaffMember` for the owner (`isOwner = true`, `role = MANAGER`, `status = ACTIVE`, `availableForBooking = true`).

---

### List all salons (platform view)

`GET /api/salon-onboarding`

**Response** `200 OK`

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Glam Salon",
    "handler": "glam-salon",
    "owner": { "name": "Jane Doe", "email": "jane@glamsalon.com", "phone": "+1234567890" },
    "location": { "address": "123 Main St", "city": "New York", "state": "NY", "country": "United States", "zipCode": "10001" },
    "contact": { "phone": "+1234567890", "email": "info@glamsalon.com", "website": "https://glamsalon.com" },
    "operatingHours": [],
    "features": ["BOOKING"],
    "bookingAdvanceDays": 60,
    "bookingRequiresConfirmation": false,
    "businessRegistrationId": "12-3456789",
    "showBusinessId": true,
    "businessIdLabel": "EIN",
    "createdAt": "2026-07-08T10:00:00Z",
    "status": "ACTIVE",
    "termsAccepted": true,
    "termsAcceptedAt": "2026-07-08T10:00:00Z"
  }
]
```

**Flow**

1. `SalonController.findAll()` → `SalonService.findAll()` → `SalonRepository.findAll()`
2. **DB**: `SELECT * FROM salon` + child rows from `salon_operating_hours` and `salon_feature`. `@Embedded` columns are hydrated into `Owner`, `Location`, and `ContactInfo`.
3. Returns `List<Salon>` — empty array if no salons exist.

---

## Customer — Salon Discovery

### Get a salon

`GET /api/salon/{salonIdOrHandler}`

Accepts either a UUID (`a1b2c3d4-e5f6-7890-abcd-ef1234567890`) or a handler slug (`glam-salon`).

**Response** `200 OK` — full salon object (includes `id`, `name`, `handler`, `owner`, `location`, `contact`, `operatingHours`, `features`, `bookingAdvanceDays`, `bookingRequiresConfirmation`, `businessRegistrationId`, `showBusinessId`, `businessIdLabel`, `createdAt`, `status`)

`businessIdLabel` is derived automatically from `location.country` (e.g. `"CVR Number"` for Denmark, `"EIN"` for United States). It is read-only — set `location.country` to update it.

**Response** `404 Not Found` — if neither a salon with that UUID nor a handler matches

**Flow**

1. `SalonController.findByIdOrHandler(String)` → `SalonService.findByIdOrHandler(String)`
2. Tries `UUID.fromString(id)` → `SalonRepository.findById(UUID)` on success.
3. Falls back to `SalonRepository.findByHandler(id)` when the value is not a valid UUID.
4. **DB**: `SELECT * FROM salon WHERE id = ?` or `SELECT * FROM salon WHERE handler = ?` + child collections.
5. Maps `Optional<Salon>` → `200 OK` or `404 Not Found`.

---

## Customer — Services

### List services

`GET /api/salon/{salonId}/services`

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "salonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
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
    "salonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
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

1. `SalonServiceController.findAll(UUID)` → `SalonServiceManager.findBySalonId(UUID)` → `SalonServiceRepository.findBySalonId(UUID)`
2. **DB**: `SELECT * FROM service_item WHERE salon_id = ?` + `service_item_assigned_staff` rows per item.
3. Returns `List<ServiceItem>` — empty array if none.

---

### Get a service

`GET /api/salon/{salonId}/services/{serviceId}`

**Response** `200 OK` — service object

**Response** `404 Not Found` — if the service does not exist or does not belong to the salon

**Flow**

1. `SalonServiceController.findById(UUID, Long)` → `SalonServiceManager.findById(UUID, Long)`
2. `SalonServiceRepository.findById(Long)` → **DB**: `SELECT * FROM service_item WHERE id = ?`
3. Result is filtered by `salonId` — returns `404` if not found or salon mismatch.

---

## Customer — Staff

### List staff

`GET /api/salon/{salonId}/staff`

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "salonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Alice Smith",
    "email": "alice@glamsalon.com",
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

> **Note**: When a salon is first created, the owner is automatically enrolled as a staff member with `isOwner = true` and `availableForBooking = true`.

**Flow**

1. `StaffController.findAll(UUID)` → `StaffService.findBySalonId(UUID)` → `StaffRepository.findBySalonId(UUID)`
2. **DB**: `SELECT * FROM staff_member WHERE salon_id = ?` + `staff_member_specialization` rows per member.
3. Returns `List<StaffMember>` — empty array if none.

---

### Get a staff member

`GET /api/salon/{salonId}/staff/{staffId}`

**Response** `200 OK` — staff member object

**Response** `404 Not Found` — if the staff member does not exist or does not belong to the salon

**Flow**

1. `StaffController.findById(UUID, Long)` → `StaffService.findById(UUID, Long)`
2. `StaffRepository.findById(Long)` → **DB**: `SELECT * FROM staff_member WHERE id = ?`
3. Filtered by `salonId` — returns `404` if not found or salon mismatch.

---

## Customer — Booking

### Get booking slots

`GET /api/salon/{salonId}/booking/slots?serviceId={serviceId}&date={date}[&staffId={staffId}]`

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

`POST /api/salon/{salonId}/booking`

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

**Response** `201 Created` — booking object. Initial `status` depends on the salon setting:
- `bookingRequiresConfirmation = false` (default) → `CONFIRMED`
- `bookingRequiresConfirmation = true` → `PENDING` (admin must confirm)

**Response** `400 Bad Request` — `appointmentDate` falls within a salon closure

**Response** `404 Not Found` — salon or service not found

**Response** `409 Conflict` — requested slot is no longer available

**Flow**

1. `BookingController.create(UUID, CreateBookingRequest)` → `BookingService.create(...)`
2. Validates the slot is still free. Calculates `endTime` from service `durationMinutes`. Reads `salonApi.bookingRequiresConfirmation(salonId)` to determine initial status (`CONFIRMED` or `PENDING`).
3. `BookingRepository.save(Booking)` → **DB**: `INSERT INTO booking`.
4. `ApplicationEventPublisher.publishEvent(BookingCreatedEvent)` → Spring Modulith persists the event before commit.
5. Returns `201 Created`.
6. After commit → **Event**: `BookingNotificationListener` logs the booking confirmation.

---

### Get a booking

`GET /api/salon/{salonId}/booking/{bookingId}`

**Response** `200 OK` — booking object

**Response** `404 Not Found`

---

## Customer — Website

### Get website theme

`GET /api/salon/{salonId}/website`

**Response** `200 OK`

```json
{
  "salonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "heroBg": "#F8FAFC",
  "heroTextColor": "#0F172A",
  "accentColor": "#1D4ED8",
  "fontFamily": "system",
  "logoBgColor": "#10B981",
  "headerBg": "#E2E8F0",
  "footerBg": "#E2E8F0",
  "mapsUrl": null,
  "chatLayout": "app",
  "websiteType": "STATIC_WEBSITE",
  "updatedAt": null
}
```

`updatedAt` is `null` when the theme has never been explicitly saved (defaults are returned in-memory). `mapsUrl` is `null` until the admin sets a Google Maps embed URL. `chatLayout` defaults to `"app"` and controls the Generative UI chat widget layout.

**Flow**

1. `WebsiteController.getTheme(UUID)` → `WebsiteThemeService.getTheme(UUID)` → `WebsiteThemeRepository.findById(UUID)`
2. **DB**: `SELECT * FROM salon_website_theme WHERE salon_id = ?`
3. If no row exists, returns a hard-coded default `WebsiteTheme` (no DB write): `heroBg="#0F172A"`, `heroTextColor="#FFFFFF"`, `accentColor="#F59E0B"`, `fontFamily="inter"`, `logoBgColor="#F59E0B"`, `updatedAt=null`.

---

## Admin — Login / Session

### Look up the caller's own salons

`GET /api/salon-admin/my-salons`

Used by the admin login flow, after the OAuth2 code exchange. The backend resolves which salon(s) belong to the authenticated caller — identity comes from the `sub` claim of the bearer token, **not** from client input, since trusting a client-supplied email would let a caller ask for someone else's salons.

**Headers**

| Header | Required | Description |
|---|---|---|
| `Authorization: Bearer {token}` | yes (real login) | Access token from the OAuth2 token exchange; `sub` is used as the owner email |

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `email` | string (email) | no | Fallback owner email, used only when no bearer token is present (local/mock-mode login). Ignored when the caller is authenticated. |

**Responses**

- `200 OK` — Array of `Salon` objects (one or more found)
- `401 Unauthorized` — No bearer token and no `email` fallback provided
- `404 Not Found` — No salon registered to this owner

**Login flow logic**

| Result | Frontend action |
|---|---|
| 1 salon | Store session, navigate to `/:salonId` |
| 2+ salons | Store session, navigate to `/salons` picker |
| 0 salons | Show "no salon found" error |

**Example**

```
GET /api/salon-admin/my-salons
Authorization: Bearer eyJhbGciOi...
```

---

## Admin — Salon Management

### Get salon (admin)

`GET /api/salon-admin/{salonId}`

**Response** `200 OK` — same salon object shape as the customer endpoint

**Response** `404 Not Found`

---

### Update salon details

`PUT /api/salon-admin/{salonId}`

Updates name, location, contact, operating hours, and business registration details. Handler, features, and **owner** are never changed by this endpoint. To change the owner, use the dedicated super-admin endpoint `PUT /api/salon-super-admin/salons/{id}/owner`.

**Request**

```json
{
  "name": "Glam Salon Uptown",
  "location": {
    "address": "456 Park Ave",
    "city": "New York",
    "state": "NY",
    "country": "United States",
    "zipCode": "10022"
  },
  "contact": {
    "phone": "+1987654321",
    "email": "uptown@glamsalon.com",
    "website": "https://glamsalon.com/uptown"
  },
  "operatingHours": [
    { "day": "MONDAY", "openTime": "10:00", "closeTime": "20:00", "closed": false }
  ],
  "businessRegistrationId": "12-3456789",
  "showBusinessId": true
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Display name of the salon |
| `location` | object | no | See [Location](#location); `businessIdLabel` is re-derived when country changes |
| `contact` | object | no | See [ContactInfo](#contactinfo) |
| `operatingHours` | array | no | Replaces existing hours when provided |
| `bookingAdvanceDays` | integer | no | Preserved if omitted |
| `businessRegistrationId` | string | no | Preserved if omitted |
| `showBusinessId` | boolean | no | Preserved if omitted |
| `bookingRequiresConfirmation` | boolean | no | Preserved if omitted. Use `PATCH .../booking-settings` for a focused update. |

**Response** `200 OK` — updated salon object

**Response** `404 Not Found`

**Flow**

1. `SalonController.update(UUID, UpdateSalonRequest)` → `SalonService.update(UUID, ...)`
2. `SalonRepository.findById(UUID)` → `404` if empty.
3. Builds a new `Salon` record preserving `id`, `handler`, `owner`, `features`, `createdAt`; replacing `name`, `location`, `contact`, `operatingHours`. `businessIdLabel` is re-derived from `location.country` when `location` is provided.
4. `SalonRepository.save(Salon)` → **DB**: `UPDATE salon SET ...` + `DELETE FROM salon_operating_hours WHERE salon_id = ?` + re-`INSERT`.
5. Returns `200 OK`.

---

### Update booking settings

`PATCH /api/salon-admin/{salonId}/booking-settings`

Partially updates only the booking-related settings. Any omitted field retains its current value.

**Request**

```json
{
  "bookingAdvanceDays": 60,
  "bookingRequiresConfirmation": true
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `bookingAdvanceDays` | integer | no | How many days in advance customers can book. Preserved if omitted. |
| `bookingRequiresConfirmation` | boolean | no | `true` = new bookings created as PENDING (require admin confirmation); `false` = auto-confirmed. Preserved if omitted. |

**Response** `200 OK` — updated salon object

**Response** `404 Not Found`

**Flow**

1. `SalonController.patchBookingSettings(UUID, PatchBookingSettingsRequest)` → `SalonService.updateBookingSettings(UUID, ...)`
2. `SalonRepository.findById(UUID)` → `404` if empty.
3. Merges non-null fields from the request with existing values; all other salon fields preserved.
4. `SalonRepository.save(Salon)` → `UPDATE salon SET booking_advance_days = ?, booking_requires_confirmation = ?`.
5. Returns `200 OK`.

---

### Replace salon features

`PUT /api/salon-admin/{salonId}/features`

Replaces the full feature list for a salon.

**Request**

```json
["BOOKING", "MEMBERSHIP", "WEBSHOP"]
```

**Response** `200 OK` — updated salon object

**Response** `404 Not Found`

**Flow**

1. `SalonController.updateFeatures(UUID, List<SalonFeature>)` → `SalonService.updateFeatures(UUID, ...)`
2. `SalonRepository.findById(UUID)` → `404` if empty.
3. Builds a new `Salon` preserving all fields except `features`.
4. `SalonRepository.save(Salon)` → **DB**: `DELETE FROM salon_feature WHERE salon_id = ?` + re-`INSERT`.
5. Returns `200 OK`.

---

### Delete a salon

`DELETE /api/salon-admin/{salonId}`

**Response** `204 No Content`

**Flow**

1. `SalonController.delete(UUID)` → `SalonService.delete(UUID)` → `SalonRepository.deleteById(UUID)`
2. **DB**: `DELETE FROM salon WHERE id = ?` — `ON DELETE CASCADE` removes rows in `salon_operating_hours`, `salon_feature`, `service_item`, and `staff_member` automatically.
3. Always returns `204` — no-op if the UUID does not exist.

---

## Admin — Website

### Get website theme (admin)

`GET /api/salon-admin/{salonId}/website`

Same response shape as the public endpoint — includes all theme fields plus `websiteType`. See [Get website theme](#get-website-theme).

---

### Save website theme

`PUT /api/salon-admin/{salonId}/website`

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
  "mapsUrl": "https://www.google.com/maps/embed?pb=...",
  "chatLayout": "app"
}
```

| Field | Type | Notes |
|---|---|---|
| `heroBg` | string | CSS color for the hero section background |
| `heroTextColor` | string | CSS color for hero text |
| `accentColor` | string | Primary accent / CTA color |
| `fontFamily` | string | Font family slug (e.g. `"system"`, `"poppins"`) |
| `logoBgColor` | string | Background color behind the salon logo |
| `headerBg` | string | Navigation bar background color |
| `footerBg` | string | Footer background color |
| `mapsUrl` | string | Google Maps embed URL for the salon location |
| `chatLayout` | string | Generative UI chat widget layout; defaults to `"app"` |

**Response** `200 OK`

```json
{
  "salonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "heroBg": "#1E293B",
  "heroTextColor": "#F8FAFC",
  "accentColor": "#6366F1",
  "fontFamily": "poppins",
  "logoBgColor": "#6366F1",
  "headerBg": "#0F172A",
  "footerBg": "#0F172A",
  "mapsUrl": "https://www.google.com/maps/embed?pb=...",
  "chatLayout": "app",
  "websiteType": "STATIC_WEBSITE",
  "updatedAt": "2026-07-08T12:00:00Z"
}
```

**Flow**

1. `WebsiteController.saveTheme(UUID, SaveThemeRequest)` → `WebsiteThemeService.saveTheme(UUID, ...)`
2. **DB**: `INSERT INTO salon_website_theme (...) ON CONFLICT (salon_id) DO UPDATE SET ...` with `updated_at = NOW()`.
3. Re-fetches the persisted row and returns `200 OK`.

---

### Get website type (admin)

`GET /api/salon-admin/{salonId}/website-type`

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

`PATCH /api/salon-admin/{salonId}/website-type`

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

## Admin — Services

### List services (admin)

`GET /api/salon-admin/{salonId}/services`

Same response as the public endpoint. See [List services](#list-services).

---

### Add a service

`POST /api/salon-admin/{salonId}/services`

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

`Location` header: `/api/salon/{salonId}/services/{serviceId}`

**Flow**

1. `SalonServiceController.add(UUID, AddServiceRequest)` → `SalonServiceManager.add(UUID, ...)`
2. Builds a `ServiceItem` with `id = null`, `active = true`, `createdAt = Instant.now()`.
3. `SalonServiceRepository.save(ServiceItem)` → **DB**: `INSERT INTO service_item` + `INSERT INTO service_item_assigned_staff`.
4. Returns `201 Created` with the saved `ServiceItem` and a `Location` header.

---

### Get a service (admin)

`GET /api/salon-admin/{salonId}/services/{serviceId}`

**Response** `200 OK` — service object

**Response** `404 Not Found`

---

### Update a service

`PUT /api/salon-admin/{salonId}/services/{serviceId}`

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

1. `SalonServiceController.update(UUID, Long, UpdateServiceRequest)` → `SalonServiceManager.update(...)`
2. `SalonServiceRepository.findById(Long)` — filtered by `salonId`, `404` on mismatch.
3. Builds a new `ServiceItem` preserving `id`, `salonId`, `createdAt`.
4. `SalonServiceRepository.save(ServiceItem)` → **DB**: `UPDATE service_item SET ...` + `DELETE FROM service_item_assigned_staff WHERE service_item_id = ?` + re-`INSERT`.
5. Returns `200 OK`.

---

### Delete a service

`DELETE /api/salon-admin/{salonId}/services/{serviceId}`

**Response** `204 No Content`

**Flow**

1. `SalonServiceController.remove(UUID, Long)` → `SalonServiceManager.remove(UUID, Long)`
2. `SalonServiceRepository.findById(Long)` — filtered by `salonId`. Skips silently if not found or wrong salon.
3. `SalonServiceRepository.deleteById(Long)` → **DB**: `DELETE FROM service_item WHERE id = ?` — cascade removes `service_item_assigned_staff` rows.
4. Always returns `204`.

---

## Admin — Staff

### List staff (admin)

`GET /api/salon-admin/{salonId}/staff`

Same response as the public endpoint. See [List staff](#list-staff).

---

### Onboard a staff member

`POST /api/salon-admin/{salonId}/staff`

**Request**

```json
{
  "name": "Alice Smith",
  "email": "alice@glamsalon.com",
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

`Location` header: `/api/salon/{salonId}/staff/{staffId}`

**Flow**

1. `StaffController.onboard(UUID, OnboardRequest)` → `StaffService.onboard(UUID, ...)`
2. Builds a `StaffMember` with `id = null`, `status = ACTIVE`, `createdAt = Instant.now()`.
3. `StaffRepository.save(StaffMember)` → **DB**: `INSERT INTO staff_member` + `INSERT INTO staff_member_specialization`.
4. Returns `201 Created`.

---

### Get a staff member (admin)

`GET /api/salon-admin/{salonId}/staff/{staffId}`

**Response** `200 OK` — staff member object

**Response** `404 Not Found`

---

### Update a staff member

`PUT /api/salon-admin/{salonId}/staff/{staffId}`

**Request**

```json
{
  "name": "Alice Smith",
  "email": "alice@glamsalon.com",
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
2. `StaffRepository.findById(Long)` — filtered by `salonId`, `404` on mismatch.
3. Builds a new `StaffMember` preserving `id`, `salonId`, `createdAt` — all other fields are replaced.
4. `StaffRepository.save(StaffMember)` → **DB**: `UPDATE staff_member SET ...` + `DELETE FROM staff_member_specialization WHERE staff_member_id = ?` + re-`INSERT`.
5. Returns `200 OK`.

---

### Remove a staff member

`DELETE /api/salon-admin/{salonId}/staff/{staffId}`

**Response** `204 No Content`

**Flow**

1. `StaffController.remove(UUID, Long)` → `StaffService.remove(UUID, Long)`
2. `StaffRepository.findById(Long)` — filtered by `salonId`. Skips silently if not found or wrong salon.
3. `StaffRepository.deleteById(Long)` → **DB**: `DELETE FROM staff_member WHERE id = ?` — cascade removes `staff_member_specialization` rows.
4. Always returns `204`.

---

## Admin — Staff Availability

### Get weekly availability schedule

`GET /api/salon-admin/{salonId}/staff/{staffId}/availability`

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "salonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
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

`PUT /api/salon-admin/{salonId}/staff/{staffId}/availability`

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

`GET /api/salon-admin/{salonId}/staff/{staffId}/availability/overrides`

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "salonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
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

`POST /api/salon-admin/{salonId}/staff/{staffId}/availability/overrides`

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

`DELETE /api/salon-admin/{salonId}/staff/{staffId}/availability/overrides/{overrideId}`

Deletes the override so the regular weekly schedule applies again for that date.
Emits **StaffAvailabilityOverrideRemovedEvent**.

**Response** `204 No Content`

---

## Customer — Holidays (read-only)

`GET /api/salon/{salonId}/holidays`

Returns all holidays defined for this salon. Used by the public website to label days as holidays in the opening-hours display.

**Response** `200 OK` — array of `SalonHoliday` objects.

---

## Admin — Holidays

Holidays automatically generate salon-closure rows (current year through currentYear+4 for recurring; one row for one-off). Deleting a holiday cascade-deletes all its linked closures.

### List holidays

`GET /api/salon-admin/{salonId}/holidays`

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "salonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Christmas Day",
    "month": 12,
    "day": 25,
    "year": null,
    "createdAt": "2026-08-06T10:00:00Z"
  }
]
```

`year: null` = annually recurring. A specific year = one-off.

---

### Add a holiday

`POST /api/salon-admin/{salonId}/holidays`

**Request**

```json
{
  "name": "Christmas Day",
  "month": 12,
  "day": 25,
  "year": null
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Human-readable holiday name |
| `month` | integer | yes | 1–12 |
| `day` | integer | yes | 1–31 |
| `year` | integer\|null | no | Omit or `null` for annually recurring; provide a year for one-off |

**Response** `200 OK` — created `SalonHoliday` object

**Flow**

1. `SalonController.addHoliday(UUID, AddHolidayRequest)` → `SalonService.addHoliday(...)`
2. Saves the `SalonHoliday` row.
3. For a specific year: inserts one `SalonClosure` row. For recurring (null year): inserts closure rows for `currentYear` through `currentYear+4`. Invalid dates (Feb 29 on non-leap years) are skipped silently.
4. Returns `200 OK`.

---

### Remove a holiday

`DELETE /api/salon-admin/{salonId}/holidays/{holidayId}`

**Response** `204 No Content`

Deletes the holiday. All linked `SalonClosure` rows are removed automatically via `ON DELETE CASCADE`.

---

## Customer — Closures (read-only)

`GET /api/salon/{salonId}/closures`

Returns all closures for the salon. Used by the booking wizard to disable closed date ranges in the calendar (month, week, and designer views).

**Response** `200 OK` — array of `SalonClosure` (same schema as admin endpoint below).

---

## Admin — Closures

Salon closures block the entire salon on a date range (vacation, public holiday, emergency). When a date falls within a closure:
- `GET .../slots` returns an **empty array**
- `POST .../booking` returns **HTTP 400**
- Booking calendar views visually disable those dates

### List closures

`GET /api/salon-admin/{salonId}/closures`

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "salonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "startDate": "2026-08-04",
    "endDate": "2026-08-15",
    "reason": "Annual vacation",
    "holidayId": null
  },
  {
    "id": 2,
    "salonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "startDate": "2026-12-25",
    "endDate": "2026-12-25",
    "reason": "Christmas Day",
    "holidayId": 1
  }
]
```

`holidayId` is non-null when the closure was auto-generated from a holiday. Holiday-backed closures cannot be deleted directly — delete the parent holiday to remove them.

---

### Add a closure

`POST /api/salon-admin/{salonId}/closures`

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

**Response** `200 OK` — the created `SalonClosure` object

---

### Remove a closure

`DELETE /api/salon-admin/{salonId}/closures/{closureId}`

**Response** `204 No Content`

---

## Admin — Booking

### List all bookings

`GET /api/salon-admin/{salonId}/booking`

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "salonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
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

`GET /api/salon-admin/{salonId}/booking/{bookingId}`

**Response** `200 OK` — booking object

**Response** `404 Not Found`

---

### Reschedule a booking

`PUT /api/salon-admin/{salonId}/booking/{bookingId}`

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

`DELETE /api/salon-admin/{salonId}/booking/{bookingId}`

**Response** `204 No Content`

---

### Confirm a booking

`POST /api/salon-admin/{salonId}/booking/{bookingId}/confirm`

Moves the booking from `PENDING` to `CONFIRMED`. Emits **BookingStatusChangedEvent**.

**Response** `200 OK` — updated booking object

**Response** `404 Not Found`

---

### Cancel a booking

`POST /api/salon-admin/{salonId}/booking/{bookingId}/cancel`

Moves the booking to `CANCELLED`. Emits **BookingStatusChangedEvent**.

**Response** `200 OK` — updated booking object

**Response** `404 Not Found`

---

### Complete a booking

`POST /api/salon-admin/{salonId}/booking/{bookingId}/complete`

Marks the appointment as `COMPLETED` after the customer's visit. Emits **BookingStatusChangedEvent**.

**Response** `200 OK` — updated booking object

**Response** `404 Not Found`

---

### Mark booking as no-show

`POST /api/salon-admin/{salonId}/booking/{bookingId}/no-show`

Records that the customer did not attend. Emits **BookingStatusChangedEvent**.

**Response** `200 OK` — updated booking object

**Response** `404 Not Found`

---

## Super Admin

Platform-wide management endpoints. Accessible via the Super Admin portal (`admin@my-salon.online` + OTP). All paths are prefixed `/api/salon-super-admin`.

### List / search salons

`GET /api/salon-super-admin/salons`

Returns registered salons across all tenants. Supports optional server-side search and status filtering. When `q` is provided the search is executed in the database (case-insensitive LIKE) across: salon name, handler, owner name/email/phone, contact phone/email, city, and country.

| Param | In | Type | Notes |
|---|---|---|---|
| `q` | query | string | Optional. Full-text search term. |
| `status` | query | `ACTIVE` \| `DISABLED` | Optional. Filter by salon status. |

**Response** `200 OK` — array of `Salon`

---

### Get a salon by ID

`GET /api/salon-super-admin/salons/{id}`

| Param | In | Type | Notes |
|---|---|---|---|
| `id` | path | uuid | Salon UUID |

**Response** `200 OK` — `Salon` · `404` if not found

---

### Update salon owner

`PUT /api/salon-super-admin/salons/{id}/owner`

Replaces the owner record (name, email, phone) for a salon. Only callable by a super-admin. The regular salon-admin update endpoint does not expose owner data.

**Request**

```json
{
  "name": "New Owner Name",
  "email": "newowner@example.com",
  "phone": "+1234567890"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Full name of the new owner |
| `email` | string | yes | Login credential — must be a valid email |
| `phone` | string | no | Optional contact phone |

**Response** `200 OK` — updated `Salon` · `400` on validation error · `404` if not found

---

### Update salon features

`PUT /api/salon-super-admin/salons/{id}/features`

Replaces the full feature set for the salon.

**Request body** — array of `SalonFeature` values, e.g. `["BOOKING", "STATIC_WEBSITE"]`

**Response** `200 OK` — updated `Salon` · `404` if not found

---

### Disable a salon

`DELETE /api/salon-super-admin/salons/{id}`

Soft-disables the salon (status → `DISABLED`). Data is preserved; salon can be re-enabled.

**Response** `200 OK` — updated `Salon` · `404` if not found

---

### Enable a salon

`PUT /api/salon-super-admin/salons/{id}/enable`

Re-activates a disabled salon (status → `ACTIVE`).

**Response** `200 OK` — updated `Salon` · `404` if not found

---

## Utility

### List countries

`GET /api/salon-utility/countries`

Returns the full list of countries with their ISO codes, dial codes, and embedded currency info. Data is loaded and joined from static classpath resources at startup — no database access occurs on this endpoint.

**Response** `200 OK`

```json
[
  { "name": "United States", "code": "US", "dialCode": "+1",  "currencyCode": "USD", "currencyName": "United States Dollar", "currencySymbol": "$",  "businessIdLabel": "EIN" },
  { "name": "Denmark",       "code": "DK", "dialCode": "+45", "currencyCode": "DKK", "currencyName": "Danish Krone",          "currencySymbol": "kr", "businessIdLabel": "CVR Number" },
  { "name": "India",         "code": "IN", "dialCode": "+91", "currencyCode": "INR", "currencyName": "Indian Rupee",          "currencySymbol": "₹",  "businessIdLabel": "CIN" }
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
| `businessIdLabel` | string | Country-specific label for the business registration number (e.g. `"CVR Number"`, `"EIN"`) |

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

### SalonFeature

| Value | Description |
|---|---|
| `STATIC_WEBSITE` | Public-facing website for the salon |
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

---

## Staff Portal

Self-service portal for authenticated staff members. Authentication is via OAuth2 (or, in local/mock mode, an email lookup + mock OTP, code `123456` in dev).

> All endpoints are scoped to the staff member by `staffId` (a `Long`). The `salonId` is derived server-side from the staff record.

### Look up the caller's own staff record(s) (login step 1)

`GET /api/salon-staff/me`

Returns all staff records for the authenticated caller. Identity comes from the `sub` claim of the bearer token — not from client input, since trusting a client-supplied email would let a caller look up someone else's staff record. Each record is a `StaffMemberSummary` — a superset of `StaffMember` that includes the salon's `name` and `handler` so the login picker can distinguish between accounts at different salons. If multiple salons employ the same email, all records are returned.

**Headers**

| Header | Required | Description |
|---|---|---|
| `Authorization: Bearer {token}` | yes (real login) | Access token from the OAuth2 token exchange; `sub` is used as the lookup email |

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `email` | string (email) | no | Fallback email, used only when no bearer token is present (local/mock-mode login). Ignored when the caller is authenticated. |

**Responses**

- `200 OK` — `StaffMemberSummary[]`
- `401 Unauthorized` — No bearer token and no `email` fallback provided
- `404 Not Found` — No staff account found for this identity

```json
[
  {
    "id": 42,
    "salonId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "salonName": "Glam Studio",
    "salonHandler": "glam-studio",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+1 555 0199",
    "role": "MANAGER",
    "status": "ACTIVE",
    "isOwner": false,
    "availableForBooking": true,
    "photoUrl": null,
    "specializations": ["HAIR_COLOR", "HIGHLIGHTS"],
    "createdAt": "2026-01-15T10:30:00Z"
  }
]
```

| Field | Type | Notes |
|---|---|---|
| `salonName` | string \| null | Display name of the salon; `null` if the salon lookup fails |
| `salonHandler` | string \| null | URL slug of the salon (e.g. `"glam-studio"`); `null` if not found |
| `role` | string | Enum name (e.g. `"MANAGER"`) |
| `status` | string | Enum name (e.g. `"ACTIVE"`) |
| `specializations` | string[] | Flat array of specialization strings |

**Response** `404` — no staff account found for this email

---

### Get own profile

`GET /api/salon-staff/{staffId}`

**Response** `200 OK` — `StaffMember`

---

### Update own profile

`PATCH /api/salon-staff/{staffId}/profile`

Staff may only update their name and phone number. Email, role, status, and specializations are admin-managed.

**Request**

```json
{ "name": "Anna Nguyen", "phone": "+1 555 0123" }
```

**Response** `200 OK` — `StaffMember`

---

### Get a photo upload URL

`POST /api/salon-staff/{staffId}/photo-upload-url`

Returns a pre-signed PUT URL the browser uses to upload a profile photo directly to S3 (or to the backend in local dev when S3 is not configured). The client should PUT the file to `presignedUrl` with the matching `Content-Type` header, then save `publicUrl` on the staff profile via `PATCH /profile`.

**Request**

```json
{ "contentType": "image/jpeg" }
```

**Response** `200 OK` — `PresignedUpload`

```json
{
  "presignedUrl": "https://my-bucket.s3.amazonaws.com/uploads/staff/42/photo.jpg?...",
  "publicUrl": "https://staff.example.com/uploads/staff/42/photo.jpg"
}
```

| Field | Type | Notes |
|---|---|---|
| `presignedUrl` | uri | Time-limited signed S3 PUT URL; in dev, a backend endpoint |
| `publicUrl` | uri | CDN/public URL to persist on the staff profile after upload |

**Response** `404` — staff member not found  
**Response** `503` — media storage not configured

---

### List own appointments

`GET /api/salon-staff/{staffId}/appointments`

Returns all `Booking` records assigned to this staff member across all dates and statuses.

**Response** `200 OK` — `Booking[]`

---

### List personal holidays

`GET /api/salon-staff/{staffId}/holidays`

Returns personal day-off records (availability overrides where `available=false`). These block the booking calendar so customers cannot book on these dates.

**Response** `200 OK` — `StaffAvailabilityOverride[]`

---

### Book a personal holiday

`POST /api/salon-staff/{staffId}/holidays`

Creates a date-specific unavailability override. Existing bookings on this date are not automatically cancelled — the staff member should notify their manager.

**Request**

```json
{ "overrideDate": "2026-12-25", "reason": "Christmas" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `overrideDate` | `date` | yes | ISO-8601 date (`YYYY-MM-DD`) |
| `reason` | string | no | Free-text note |

**Response** `201 Created` — `StaffAvailabilityOverride`

---

### Remove a personal holiday

`DELETE /api/salon-staff/{staffId}/holidays/{holidayId}`

**Response** `204 No Content`
