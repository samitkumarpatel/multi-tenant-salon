# API Reference

Base path: `/api`

All request and response bodies are `application/json`. Service, staff, and booking IDs are `Long` integers.

Every `{salonId}` (or `{id}`) path segment that identifies a salon — across `/api/salon/**`,
`/api/salon-admin/**`, and `/api/salon-super-admin/salons/**` — accepts **either** the salon's
UUID (`a1b2c3d4-e5f6-7890-abcd-ef1234567890`) **or** its handler slug (`glam-salon`). The UUID
form is tried first; if the value isn't a valid UUID it falls back to a handler lookup. Returns
`404 Not Found` if neither matches. This is implemented once, centrally, as `SalonApi.resolveId(String)`
(`salon/SalonApi.java`, backed by `SalonService.resolveId` → the existing `findByIdOrHandler`
lookup), and every controller that takes a salon-scoping path variable calls it first. Response
bodies always return the real UUID in their `salonId`/`id` fields, regardless of which form was
used in the request.

---

## Errors

Every error response (`4xx`/`5xx`) is an [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)
problem detail, served as `application/problem+json` and produced centrally by
`GlobalExceptionHandler` (`@RestControllerAdvice` extending `ResponseEntityExceptionHandler`).

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Salon not found",
  "instance": "/api/salon/nan/booking/slots",
  "timestamp": "2026-09-02T10:15:30.123Z"
}
```

| Field | Notes |
|---|---|
| `type` | Problem type URI; `about:blank` for generic errors. |
| `title` | Short, human-readable summary of the status code. |
| `status` | HTTP status code, repeated in the body. |
| `detail` | Specific explanation (e.g. `Salon not found`, `Failed to convert 'serviceId'`). |
| `instance` | The request path that failed. |
| `timestamp` | When the error was produced. |

Common cases: unknown salon UUID/handler → `404`; non-numeric `{serviceId}` / query param →
`400`; unknown route → `404`; missing bearer token on a protected endpoint → `401`; wrong
role / not the salon's owner → `403`.

---

## Path Namespace Overview

| Namespace | Base Path | Audience |
|---|---|---|
| **Salon Onboarding** | `/api/salon-onboarding` | New tenant registration; platform-level listing |
| **Customer** | `/api/salon/{salonId}/...` | Public/customer-facing — browse, book, read |
| **Admin** | `/api/salon-admin/{salonId}/...` | Salon owner/administrator — manage, configure, operate. Also callable by a platform super-admin for any salon, since super-admin management of a specific salon reuses these endpoints rather than duplicating them. |
| **Super Admin** | `/api/salon-super-admin/...` | Platform super-admin — cross-tenant management of all salons |
| **Staff Portal** | `/api/salon-staff/...` | Authenticated staff member — self-service profile, appointments, personal holidays |
| **Utility** | `/api/salon-utility/...` | Any consumer needing reference data (countries with embedded currency info) |
| **Analytics Ingestion** | `/api/analytics/events` | Public, anonymous — client-side JS on the salon's public website reporting page views/clicks |

Customer sub-paths: `/services/...`, `/staff/...`, `/booking/...`, `/website`, `/chat`

Admin sub-paths: `/services/...`, `/staff/...`, `/booking/...`, `/closures`, `/holidays`, `/booking-settings`, `/contact`, `/website`, `/website-type`, `/features`, `/analytics/summary`

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
   - `SalonNotificationListener.onSalonCreated(SalonCreatedEvent)` → `NotificationService.notifySalonOnboarded(...)` sends a welcome email to the owner (via Mailjet; logged instead when `MAILJET_API_KEY` is unset) with links to the admin panel and the salon's public website.
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

This endpoint returns the full salon object either way, which is why it has its own
`findByIdOrHandler` returning `Optional<Salon>`. Every other endpoint only needs the resolved
UUID to scope its own query, so they call the lighter-weight `SalonService.resolveId(String)` /
`SalonApi.resolveId(String)` (throws `404` directly) instead — see the note at the top of this
document.

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
    "avatarUrl": "https://cdn.example.com/staff/alice-avatar.jpg",
    "workMedia": ["https://cdn.example.com/staff/alice-1.jpg", "https://cdn.example.com/staff/alice-reel.mp4"],
    "bio": "Alice has 10 years of experience in color and balayage.",
    "createdAt": "2026-07-08T10:00:00Z"
  }
]
```

> **Note**: When a salon is first created, the owner is automatically enrolled as a staff member with `isOwner = true` and `availableForBooking = true`.

| Field | Type | Notes |
|---|---|---|
| `avatarUrl` | string | Profile photo. Persisted in the `staff_member.profile_photo_url` column (mapped via `@Column`). |
| `bio` | string | Free-text "About me" blurb shown on the public website. |
| `workMedia` | array | Image **or video** URLs of the staff member's work (`.mp4` / `.webm` / `.mov` render as video on the site). Child rows in `staff_member_photo` (table name unchanged). |

**Flow**

1. `StaffController.findAll(UUID)` → `StaffService.findBySalonId(UUID)` → `StaffRepository.findBySalonId(UUID)`
2. **DB**: `SELECT * FROM staff_member WHERE salon_id = ?` + `staff_member_specialization` and `staff_member_photo` rows per member.
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

### Get a staff member's schedule gaps

`GET /api/salon/{salonId}/staff/{staffId}/schedule`

Rolls up the days this staff member is **never** bookable — their recurring weekly days off, plus
one-off unavailable dates — from the exact same data [Get booking slots](#get-booking-slots)
already checks per date. Lets a booking calendar grey out days for a specific staff member up
front (e.g. once pre-picked via "Book with {name}", or when they're the only one who can perform
the service) instead of only discovering a day is empty after the visitor picks it and calls
`/booking/slots`.

**Response** `200 OK`

```json
{
  "closedWeekdays": ["MONDAY", "SATURDAY"],
  "closedDates": ["2026-09-14"]
}
```

| Field | Notes |
|---|---|
| `closedWeekdays` | Day-of-week names (`MONDAY`–`SUNDAY`) with no `available` weekly-schedule row for this staff member |
| `closedDates` | One-off dates (`yyyy-MM-dd`) with an unavailable `StaffAvailabilityOverride` — dates where they're exceptionally *available* (an override with `available: true`, e.g. covering an extra day) are **not** included |

**Flow**

1. `BookingController.getStaffSchedule(String salonId, Long staffId)` → `SalonApi.resolveId(salonId)` → `BookingService.findStaffSchedule(salonId, staffId)`.
2. Computes `closedWeekdays` as all seven days minus those with an `available = true` row in `staff_availability`.
3. Computes `closedDates` as every `staff_availability_override` row for this staff member with `available = false`.

---

### Query availability across a date range

`GET /api/salon/{salonId}/availability[?serviceId=&staffId=&from=&to=&granularity=DAY|SLOT&limit=]`

One call that answers the whole Gen-UI / assistant booking flow — "which days can I come in",
"what times on this day", "which days does this stylist work", "who's free on this day", "when's
the earliest opening". All params optional:

| Param | Default | Notes |
|---|---|---|
| `serviceId` | — | Sizes the slots; with no `staffId`, also picks the candidate stylists. Omit → default 30-min duration + all bookable staff. `404` if the id isn't this salon's. |
| `staffId` | — | Restrict to one stylist. `404` if not this salon's. |
| `from` | today | Clamped up to today if in the past. |
| `to` | `from` + salon `bookingAdvanceDays` | Span is hard-capped at **92 days**. |
| `granularity` | `DAY` | `SLOT` also fills each day's `slots` array. |
| `limit` | — | Return only the first N `OPEN` days (blocked days omitted from `days`). |

**Response** `200 OK`

```json
{
  "serviceId": 3,
  "serviceName": "Haircut",
  "durationMinutes": 45,
  "staffId": null,
  "from": "2026-09-04",
  "to": "2026-10-04",
  "days": [
    { "date": "2026-09-04", "weekday": "FRIDAY", "status": "SALON_CLOSED",
      "reason": "Staff Training Day", "openSlotCount": 0, "firstOpenTime": null,
      "availableStaffIds": [], "slots": null },
    { "date": "2026-09-05", "weekday": "SATURDAY", "status": "OPEN",
      "reason": null, "openSlotCount": 6, "firstOpenTime": "10:00",
      "availableStaffIds": [2, 5], "slots": null }
  ],
  "firstAvailable": { "date": "2026-09-05", "startTime": "10:00", "staffId": 2 }
}
```

| `status` | Meaning |
|---|---|
| `OPEN` | At least one unbooked slot exists |
| `SALON_CLOSED` | Holiday, one-off closure, or a non-working weekday — `reason` names it |
| `STAFF_OFF` | Salon open, but no candidate stylist is scheduled that day |
| `FULLY_BOOKED` | Stylist(s) working, every slot already taken |

`weekday` is server-computed for `date` — callers (and the chat assistant) must use it verbatim
rather than deriving it. `slots` is `null` unless `granularity=SLOT`; each entry matches
[`AvailableSlot`](#get-booking-slots) (`staffId`, `startTime`, `endTime`, `booked`).
`firstAvailable` is `null` when nothing in the range is bookable.

**Flow**

1. `BookingController.getAvailability(...)` → `SalonApi.resolveId(salonId)` → `BookingService.queryAvailability(...)`.
2. Pre-fetches (once) the salon's closures + operating hours, every staff weekly row and override, and all active bookings in `[from, to]`.
3. Walks each date: salon-wide closed → `SALON_CLOSED`; else per candidate stylist resolves the working window (override beats weekly row) and generates slots at service-duration intervals, marking `booked` against the pre-fetched bookings; classifies the day and records `firstAvailable`.
4. Backs the assistant's `checkAvailability` (single date) and `findAvailableDates` (range) tools.

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
4. `ApplicationEventPublisher.publishEvent(BookingCreatedEvent)` → Spring Modulith persists the event before commit. Also looks up the assigned staff member via `StaffApi.findByIdAndSalonId(...)` and publishes `StaffBookingAssignedEvent` (skipped if the staff member has no email on file).
5. Returns `201 Created`.
6. After commit → **Events**: `BookingNotificationListener` → `NotificationService.notifyBookingCreated(...)` emails the customer a booking-received confirmation, and `NotificationService.notifyStaffBookingAssigned(...)` emails the assigned staff member.

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
  "heroBg": "#EEF2F4",
  "heroTextColor": "#0F172A",
  "accentColor": "#4B5563",
  "fontFamily": "Noto Sans KR",
  "logoBgColor": "#DB2777",
  "headerBg": "#E2E8F0",
  "footerBg": "#E2E8F0",
  "mapsUrl": null,
  "chatLayout": "fullscreen",
  "chatBg": "#EEF2F4",
  "websiteType": "STATIC_WEBSITE",
  "updatedAt": null
}
```

`updatedAt` is `null` when the theme has never been explicitly saved (defaults are returned in-memory). `mapsUrl` is `null` until the admin sets a Google Maps embed URL. `chatLayout` controls how the Generative UI chat opens — `"windowed"` for a centered card, `"fullscreen"` (the default) otherwise. The legacy value `"app"` is treated as `"fullscreen"`. `fontFamily` is either a preset slug (`"nunito"`, `"playfair"`, …) or any Google Fonts family name (`"Noto Sans KR"`, `"Roboto Slab"`, …) — the admin picker offers both; the default is `"Noto Sans KR"`.

**Flow**

1. `WebsiteController.getTheme(UUID)` → `WebsiteThemeService.getTheme(UUID)` → `WebsiteThemeRepository.findById(UUID)`
2. **DB**: `SELECT * FROM salon_website_theme WHERE salon_id = ?`
3. If no row exists, returns a hard-coded default `WebsiteTheme` (no DB write): `heroBg="#EEF2F4"`, `heroTextColor="#0F172A"`, `accentColor="#4B5563"`, `fontFamily="Noto Sans KR"`, `logoBgColor="#DB2777"`, `chatBg="#EEF2F4"`, `chatLayout="fullscreen"`, `updatedAt=null`.

---

## Customer — Chat

### Chat with the AI assistant

`POST /api/salon/{salonId}/chat`

Powers the Generative UI website mode's chat. The assistant is an Anthropic model (Spring AI
`ChatClient`) with tool-calling access to this same salon's own public profile/staff/services/
holidays endpoints and the [availability query](#query-availability-across-a-date-range) — every
fact it states comes from a live tool call, not the model's own knowledge, and `salonId` is bound
server-side so the model can never be steered into answering about a different tenant. The system
prompt also restricts it to this salon's own topics (services, staff, pricing, hours, location,
contact, holidays, booking) — off-topic requests, and attempts to override these instructions,
are declined rather than answered.

Two availability tools are backed by `GET /api/salon/{salonId}/availability`:
`checkAvailability(serviceId, date, staffId?)` for one date (returns `status`, `weekday`,
`reason`, `slots`, and the soonest opening as `nextAvailable`), and
`findAvailableDates(serviceId?, staffId?, from?, to?, limit?)` for a range. The system prompt
also pins today's weekday and forbids the model from deriving any other date's weekday itself —
it must use the `weekday`/`reason` the tool returns.

**Request**

```json
{
  "sessionId": "5f2b…",
  "context": "website",
  "message": "What are your opening hours?",
  "uiState": "[Showed the visitor an interactive services card: Haircut, Colour]"
}
```

`context` is `"website"` or `"booking"` and shapes the assistant's persona/tone (matches the two
places `GenerativeUIWebsite` is embedded). `sessionId` is an opaque key the frontend mints once
(`crypto.randomUUID()`, persisted in `sessionStorage`) and reuses for the life of the chat — the
**server keeps the transcript** under `{salonId}:{sessionId}` in a TTL memory
(`spring.application.chat.memory.ttl`, default 30 min idle; trimmed to
`…memory.max-messages`, default 20). The client no longer sends `history`. When `sessionId` is
blank/omitted the server mints one and returns it in `sessionId`; "Clear chat" mints a fresh one
and the old transcript is left to expire.

The chat renders **generative-UI components** (services/staff/hours/location/contact cards, the
interactive booking picker, and the standalone date/time pickers, forms and choice lists) in
place of plain assistant text, and those interactions never pass through this endpoint. So the
frontend sends **one `uiState` note** describing what the visitor currently sees / is part-way
through, e.g.:

```
[Showed the visitor an interactive services card: Haircut, Colour, Beard trim. They can tap "Book" on any of them.]
[The visitor is using the interactive booking picker for Haircut — they have NOT confirmed a booking. Selected so far — stylist: any available stylist; date: 2026-09-01; time: not chosen yet. Current step: time. ...]
```

The server records `uiState` as a synthetic prior assistant turn in memory before the message —
this is what lets the assistant answer a later free-text follow-up ("is that booked yet?", "what
did I pick?", "show me that list again") with context instead of a blank. The system prompt
(`UI_STATE_NOTES` in `ChatAssistantService`) instructs the model to treat bracketed notes as
current state and never echo them. Booking state specifically: an in-progress picker → "not
booked yet"; a staged proposal → "awaiting your confirm click"; a confirmed booking → the
booking id.

**Response** `200 OK`

```json
{
  "sessionId": "5f2b…",
  "message": "Here's what we offer:",
  "components": [{ "type": "services", "props": { "forBooking": false } }],
  "suggestedQuestions": ["How much is a haircut?", "Who does colour?", "Can I book one?"],
  "toolsUsed": ["services"],
  "pendingBooking": null
}
```

`sessionId` echoes the request's, or is the freshly minted one — reuse it next turn.

`toolsUsed` lists which data-lookup tools the model called to answer (`salon`, `staff`,
`services`, `holidays`, `slots`, `booking-proposal`) — empty when no lookup was needed, or when the
assistant is unconfigured/unavailable and a fallback reply was returned instead. The `show*` /
`start*` render tools are **not** listed here — they're not data lookups; the `components`
array is their output.

`components` is the **generative-UI render list**: the model decides what to show by calling
render tools (`showServices`, `showStaff`, `showOpeningHours`, `showLocation`, `showContact`,
`startBookingPicker`, `showDatePicker`, `showTimeSlots`, `showForm`, `showButtonGroup`,
`showRadioGroup`, `showCheckboxGroup`, `showOptionList`), and a turn can carry **several**
(e.g. a services card *plus* a button group), rendered in order under the reply. `[]` for a
plain-text turn. Each entry is `{ "type": …, "props": {…} }`:

| `type` | `props` | meaning |
|---|---|---|
| `services` | `forStaffId?`, `forBooking?` | services card, optionally filtered / framed as "pick one to book" |
| `staff` | `forServiceId?` | team card, optionally filtered to who can do a service |
| `hours` / `location` / `contact` | — | the matching data card |
| `booking-picker` | `serviceId`, `staffId?`, `date?` | full guided staff→date→time→contact→confirm picker; `date` (yyyy-MM-dd) is the day the visitor named, resolved by the assistant — the picker opens on it |
| `date-picker` | `serviceId?`, `staffId?`, `date?` | lightweight "which day works" calendar; `date` (yyyy-MM-dd), when set, is the day it opens on |
| `time-slot-picker` | `serviceId`, `date`, `staffId?` | real bookable slots for a day (fetches `/slots` itself) |
| `form` | `title`, `submitLabel?`, `fields[] {name,label,type,required,pattern}` | short field collector |
| `button-group` / `radio-group` / `checkbox-group` / `option-list` | `prompt`, `choices[] {label,value}` | a choice to tap; the `value` is sent to `POST .../chat` as the visitor's next message |

`props` is **UI scaffolding only** — ids, flags, labels, field/choice specs — never salon data:
data-bearing components hydrate from the live public API on the frontend, so the model can't bake
a stale price or a made-up slot into the page. The frontend maps each `type` against its registry
and **ignores anything it doesn't recognise** (the reply text still renders), so a stray or
renamed component can't break a turn. Quick-action chips ("Our Services", "Find Us", …) still
render their card client-side with no model call.

`suggestedQuestions` are the 2-4 chips shown **above the composer** — generated inline with the
reply (same content as `POST .../chat/followups`), scoped to what the assistant can answer, `[]`
when the model is unconfigured/unavailable. Each is sent to `POST .../chat` verbatim when tapped.

`pendingBooking` is present only when the assistant staged a booking this turn (the direct-detail
path — the picker path returns a `booking-picker` component instead and the visitor completes it
client-side):

```json
{
  "sessionId": "5f2b…",
  "message": "Here's your booking — please review and confirm below.",
  "components": [],
  "suggestedQuestions": [],
  "toolsUsed": ["services", "slots", "booking-proposal"],
  "pendingBooking": {
    "serviceId": 12,
    "staffId": 3,
    "customerName": "Jane Doe",
    "customerEmail": "jane@example.com",
    "customerPhone": null,
    "appointmentDate": "2026-09-01",
    "startTime": "10:00",
    "notes": null
  }
}
```

It has exactly the same shape as [`CreateBookingRequest`](#create-a-booking). **The assistant
never creates the booking itself** — the frontend shows this to the visitor, and only once they
explicitly confirm does it `POST` this object verbatim to `/api/salon/{salonId}/booking` (see
`## Customer — Booking`), which does the real validation (availability, conflicts, salon hours)
and fires the same booking-confirmation email as the step-by-step wizard.

**Flow**

1. `ChatController.chat(...)` → `ChatAssistantService.reply(salonId, conversationId, context, message, uiState)`
   (`conversationId` = `{salonId}:{sessionId}`).
2. Records `uiState` (if any) into `ChatMemory` as a synthetic assistant turn, then calls the
   model with a system prompt for the given `context`, a `MessageChatMemoryAdvisor` that replays
   the stored transcript, and a per-request `SalonDataTools` instance bound to `salonId`. The
   model can call:
   - **lookup tools** — `getSalonProfile`/`getStaff`/`getServices`/`getHolidays` (plain HTTP
     calls to this app's own `/api/salon/{salonId}/...` endpoints above) and `checkAvailability`
     (calls `/api/salon/{salonId}/booking/slots`, so it can't invent an open time);
   - **render tools** — `showServices`/`showStaff`/`showOpeningHours`/`showLocation`/
     `showContact`/`startBookingPicker`/`showDatePicker`/`showTimeSlots`/`showForm`/
     `showButtonGroup`/`showRadioGroup`/`showCheckboxGroup`/`showOptionList`, which hit nothing
     and only append a `UiComponent` to the response `components` list;
   - `proposeBooking`, which does **not** call any mutating endpoint — it only records the
     proposed details onto the response as `pendingBooking`.
3. After the reply, `ChatFollowupsService` runs over the updated memory to fill
   `suggestedQuestions`.
4. If the model call fails (no/invalid API key, rate limit, network error), the error is logged
   and a fixed fallback message is returned — the endpoint never returns 5xx for this reason.

### Suggested follow-up questions

`POST /api/salon/{salonId}/chat/followups`

Powers the chips **above the composer** — which are *only* these dynamic suggestions, never the
fixed category options. `POST .../chat` already returns `suggestedQuestions` inline, so the
frontend only calls this endpoint separately when something rendered **without** a `/chat`
round-trip — an instant card from a fixed sidebar option, or a booking-picker step change.
`ChatFollowupsService` reads the transcript from memory (by `sessionId`) and generates 2-4 short
next questions **from the latest message** — the `uiState` override when given, otherwise the last
stored turn. Not cached. The chat's **sidebar and empty-state** cards remain the fixed category
options (Our Services / Our Staff / Opening Hours / Find Us / Contact Us / Book).

**Request**

```json
{
  "sessionId": "5f2b…",
  "context": "website",
  "uiState": "[Showed the visitor an interactive services card: Haircut, Colour]"
}
```

**Response** `200 OK`

```json
{ "followups": ["How much is a haircut?", "Who does colour?", "Can I book one?"] }
```

Scoped to what the assistant can answer (services/pricing, staff, hours, location, contact,
holidays — plus booking only when the salon has the `BOOKING` feature). `followups` is `[]` when
the model is unconfigured or the call/parse fails — the frontend then shows its static suggestion
chips instead. Each string is sent to `POST .../chat` verbatim when tapped.

---

## Analytics — Public Ingestion

### Ingest a batch of website activity events

`POST /api/analytics/events`

Called anonymously from the public salon website's client-side JS — **no authentication
required**; `/api/analytics/**` is in the security config's `permitAll` matchers. This is the
only endpoint in the API meant to be called without any credential at all.

**Request** — a JSON array (batch) of activity events, max **200 per request**:

```json
[
  { "salonId": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "sessionId": "a1b2c3", "eventType": "PAGE_VIEW", "path": "/", "occurredAt": "2026-08-31T10:15:30Z" },
  { "salonId": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "sessionId": "a1b2c3", "eventType": "CLICK", "path": "/", "label": "hero-book-appointment", "occurredAt": "2026-08-31T10:15:42Z" }
]
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `salonId` | string (UUID) | yes | Salon the event belongs to |
| `sessionId` | string | no | Client-generated session identifier |
| `eventType` | string enum | yes | `PAGE_VIEW` or `CLICK` |
| `path` | string | yes | The page path the event occurred on |
| `label` | string | no | A `data-track` attribute value identifying what was clicked. Typically present for CLICK events, absent for PAGE_VIEW |
| `occurredAt` | string (ISO-8601 instant) | no | Client-reported event time; server uses the current server time if omitted |

**Response** `202 Accepted` — no body.

This holds even if some or all events in the batch are silently dropped. There is no per-event
status in the response.

**Response** `400 Bad Request` — batch has more than 200 events.

**Dropped, not rejected:** an event is silently dropped (not an error, no indication in the
response) if the salon does not exist, **or** the salon exists but has not enabled the
`ANALYTICS` feature flag. This is the only real access control on this anonymous endpoint, and
it's deliberate — document it as expected behavior, not a bug, when auditing dropped events.

**Flow**

1. `AnalyticsIngestController.receive(List<ActivityEventRequest>)` — rejects (`400`) if the
   batch exceeds `MAX_BATCH_SIZE` (200); an empty/null batch is accepted as a no-op.
2. For each event: `SalonApi.findById(salonId)` then a check that the salon's `features` list
   contains `ANALYTICS`. Either miss → the event is dropped (logged at `debug`, nothing thrown).
3. Otherwise `AnalyticsQueueGateway.send(...)` Base64-encodes the event as JSON and pushes it to
   an Azure Storage Queue message. If the queue client isn't configured, the event is logged
   instead of enqueued (dev/local default) — same "sends are logged instead" pattern the
   `notification` module uses for Mailjet.
4. A separate queue consumer (`AnalyticsQueueConsumer`) asynchronously persists queued events to
   the `analytics_event` table. There is no synchronous confirmation from this endpoint that any
   given event was actually stored.
5. Returns `202 Accepted` regardless of how many events (if any) made it past step 2.

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
5. `ApplicationEventPublisher.publishEvent(SalonUpdatedEvent)` — after commit, `SalonNotificationListener.onSalonUpdated(...)` emails the owner that their salon settings changed.
6. Returns `200 OK`.

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
5. `ApplicationEventPublisher.publishEvent(SalonUpdatedEvent)` — owner is emailed that their salon settings changed.
6. Returns `200 OK`.

---

### Update contact block

`PATCH /api/salon-admin/{salonId}/contact`

Replaces **only** the salon's `contact` block — phone/email/website plus the social links and
their per-platform visibility flags. Every other salon field (name, location, hours, features …)
is preserved. This is the narrow endpoint the admin **Website** tab uses so saving social links
can't clobber the rest of the salon.

The request body is a full [ContactInfo](#contactinfo) object and **replaces** the stored one —
send the fields you want to keep, not just the ones that changed (omitted fields become null).

**Request**

```json
{
  "phone": "+1222333444",
  "email": "hello@yoursalon.com",
  "website": "https://yoursalon.com",
  "facebook": "https://facebook.com/yoursalon",
  "facebookVisible": true,
  "instagramVisible": false
}
```

**Response** `200 OK` — updated salon object

**Response** `404 Not Found`

**Flow**

1. `SalonController.patchContact(UUID, ContactInfo)` → `SalonService.updateContact(UUID, ContactInfo)`
2. `SalonRepository.findById(UUID)` → `404` if empty.
3. Rebuilds the `Salon` with the new `contact`, every other field copied from the existing record.
4. `SalonRepository.save(Salon)` → `UPDATE salon SET contact_* = ?`.
5. `ApplicationEventPublisher.publishEvent(SalonUpdatedEvent)`.
6. Returns `200 OK`.

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
5. `ApplicationEventPublisher.publishEvent(SalonUpdatedEvent)` — owner is emailed that their salon settings changed.
6. Returns `200 OK`.

---

### Delete a salon

`DELETE /api/salon-admin/{salonId}`

**Response** `204 No Content`

**Flow**

1. `SalonController.delete(UUID)` → `SalonService.delete(UUID)` → `SalonRepository.deleteById(UUID)`
2. **DB**: `DELETE FROM salon WHERE id = ?` — `ON DELETE CASCADE` removes rows in `salon_operating_hours`, `salon_feature`, `service_item`, and `staff_member` automatically.
3. Always returns `204` — no-op if the UUID does not exist.

---

## Admin — Analytics

### Get website analytics summary

`GET /api/salon-admin/{salonId}/analytics/summary?days={days}`

Owner-facing rollup of the events ingested via [`POST /api/analytics/events`](#ingest-a-batch-of-website-activity-events).

Requires the same Bearer JWT auth as every other `/api/salon-admin/{salonId}/**` endpoint: the
caller must be the salon's owner (per the `salons` claim in their JWT) or hold
`ROLE_SUPER_ADMIN`. This is enforced by the app's global security config (`MultiTenantSalonApplication`),
not by the controller itself.

| Parameter | In | Required | Notes |
|---|---|---|---|
| `salonId` | path | yes | Salon UUID or handler slug — same resolution rule as every other `{salonId}` path segment (see top of this document) |
| `days` | query | no | Look-back window in days. Default `7`. Clamped server-side to the range 1–90 |

**Response** `200 OK`

```json
{
  "totalViews": 128,
  "totalClicks": 34,
  "viewsByDay": [
    { "day": "2026-08-25", "count": 12 },
    { "day": "2026-08-26", "count": 18 }
  ],
  "topPages": [
    { "path": "/", "count": 80 },
    { "path": "/book", "count": 40 }
  ],
  "topClicks": [
    { "label": "hero-book-appointment", "count": 20 },
    { "label": "nav-book-now", "count": 14 }
  ]
}
```

| Field | Notes |
|---|---|
| `totalViews` / `totalClicks` | Totals across the **full requested window**, not just the top-10 lists below |
| `viewsByDay[].day` | ISO-8601 date (`yyyy-MM-dd`) |
| `topPages` | Top 10 paths by view count, descending |
| `topClicks` | Top 10 click labels by count, descending |

**Response** `403 Forbidden` — the target salon has not enabled the `ANALYTICS` feature flag, in
addition to the normal `403` a caller gets from the global security config for not owning the
salon.

**Flow**

1. `AnalyticsAdminController.summary(String salonId, int days)` → `SalonApi.resolveId(salonId)`
   (UUID first, falls back to handler slug).
2. Looks up the salon and checks its `features` list contains `ANALYTICS`; if not, returns `403`
   before querying any event data.
3. Clamps `days` to `[1, 90]`, then `AnalyticsSummaryService.summarize(salonId, days)` runs four
   aggregate queries against the `analytics_event` table (total views, total clicks, daily view
   counts, top-10 pages, top-10 click labels) scoped to `occurred_at >= now - days`.
4. Returns `200 OK` with the assembled `AnalyticsSummary`.

---

### Get Generative-UI chat usage summary

`GET /api/salon-admin/{salonId}/analytics/genui-summary?days={days}`

Owner-facing rollup of how visitors are using the Generative-UI chat widget on the public
website/booking page — messages sent, interactive components shown, data-lookup tools invoked,
and bookings proposed through chat. Recorded server-side whenever `POST /api/salon/{salonId}/chat`
runs (see [Chat with the AI assistant](#chat-with-the-ai-assistant)); requires the same `ANALYTICS` feature flag
as the website summary above — nothing is recorded, let alone returned, for a salon that hasn't
opted in.

Requires the same Bearer JWT auth as every other `/api/salon-admin/{salonId}/**` endpoint.

| Parameter | In | Required | Notes |
|---|---|---|---|
| `salonId` | path | yes | Salon UUID or handler slug |
| `days` | query | no | Look-back window in days. Default `7`. Clamped server-side to the range 1–90 |

**Response** `200 OK`

```json
{
  "totalSessions": 42,
  "totalMessages": 210,
  "totalBookingsProposed": 15,
  "topComponents": [
    { "type": "services", "count": 60 },
    { "type": "staff", "count": 25 },
    { "type": "quick-actions", "count": 12 }
  ],
  "topTools": [
    { "tool": "services", "count": 80 },
    { "tool": "staff", "count": 34 }
  ]
}
```

| Field | Notes |
|---|---|
| `totalSessions` | Distinct chat `sessionId`s seen in the window |
| `totalMessages` | Total visitor messages sent to the assistant |
| `totalBookingsProposed` | Turns where the assistant staged a booking proposal (`proposeBooking`) |
| `topComponents` | Top 10 interactive component types rendered (`services`, `staff`, `staff-profile`, `quick-actions`, `booking-picker`, ...), descending by count. `quick-actions` is a useful proxy for how often visitors asked something off-topic with nothing else in progress |
| `topTools` | Top 10 data-lookup tool names the assistant invoked (`salon`, `staff`, `services`, `holidays`, `slots`), descending by count |

**Response** `403 Forbidden` — the target salon has not enabled the `ANALYTICS` feature flag.

**Flow**

1. `ChatController.chat(...)` publishes one `GenUiInteractionEvent` per notable happening in the
   turn (message sent, each component shown, each tool invoked, a booking proposal) via
   `ApplicationEventPublisher` — a plain in-process Spring application event, not the Azure queue
   the public page-view/click beacon uses, since chat already runs trusted and server-side.
2. `analytics.internal.GenUiAnalyticsListener` (`@ApplicationModuleListener`) resolves the salon id
   and, only if `ANALYTICS` is enabled, persists a row per event into `genui_event`.
3. `AnalyticsAdminController.genUiSummary(String salonId, int days)` resolves the salon id, checks
   `ANALYTICS` is enabled (`403` otherwise), clamps `days` to `[1, 90]`, then
   `AnalyticsSummaryService.summarizeGenUi(salonId, days)` aggregates `genui_event` and returns the
   assembled `GenUiSummary`.

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
  "chatLayout": "fullscreen"
}
```

| Field | Type | Notes |
|---|---|---|
| `heroBg` | string | CSS color for the hero section background |
| `heroTextColor` | string | CSS color for hero text |
| `accentColor` | string | Primary accent / CTA color |
| `fontFamily` | string | Preset slug (`"poppins"`, …) or a Google Fonts family name (`"Noto Sans KR"`, …); default `"Noto Sans KR"` |
| `logoBgColor` | string | Background color behind the salon logo |
| `headerBg` | string | Navigation bar background color |
| `footerBg` | string | Footer background color |
| `mapsUrl` | string | Google Maps embed URL for the salon location |
| `chatLayout` | string | How the Generative UI chat opens: `"windowed"` or `"fullscreen"` (default) |

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
  "chatLayout": "fullscreen",
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
  "workMedia": ["https://cdn.example.com/staff/alice-1.jpg"],
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
| `workMedia` | array | no | Image or video URLs of the staff member's work, shown on the public website |
| `bio` | string | no | Free-text "About me" blurb shown on the public website |

New staff members are set to `status = ACTIVE` automatically.

**Response** `201 Created` — staff member object

`Location` header: `/api/salon/{salonId}/staff/{staffId}`

**Flow**

1. `StaffController.onboard(UUID, OnboardRequest)` → `StaffService.onboard(UUID, ...)`
2. Builds a `StaffMember` with `id = null`, `status = ACTIVE`, `createdAt = Instant.now()`.
3. `StaffRepository.save(StaffMember)` → **DB**: `INSERT INTO staff_member` + `INSERT INTO staff_member_specialization` + `INSERT INTO staff_member_photo`.
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
  "workMedia": ["https://cdn.example.com/staff/alice-1.jpg"],
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
4. `StaffRepository.save(StaffMember)` → **DB**: `UPDATE staff_member SET ...` + `DELETE`/re-`INSERT` of the `staff_member_specialization` and `staff_member_photo` child rows.
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
- `GET .../booking/slots` returns an **empty array**
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
| `id` | path | string | Salon UUID or handler slug — see the note at the top of this document |

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

Re-activates a disabled salon (status → `ACTIVE`). Emits **SalonUpdatedEvent** — owner is emailed that their salon settings changed.

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

`ANALYTICS` pre-dates the endpoints that use it — the flag was already part of this enum. What's
new is the pair of endpoints that actually activate it: [`POST /api/analytics/events`](#ingest-a-batch-of-website-activity-events)
(ingestion) and [`GET /api/salon-admin/{salonId}/analytics/summary`](#get-website-analytics-summary)
(the owner-facing rollup). No enum/schema change was needed for the flag itself.

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

| Field | Type | Notes |
|---|---|---|
| `phone` | string | |
| `email` | string | |
| `website` | string | |
| `facebook` | string | Public Facebook profile/page URL |
| `facebookVisible` | boolean | Show the Facebook icon in the website footer |
| `instagram` | string | Public Instagram profile URL |
| `instagramVisible` | boolean | Show the Instagram icon in the website footer |
| `tiktok` | string | Public TikTok profile URL |
| `tiktokVisible` | boolean | Show the TikTok icon in the website footer |
| `youtube` | string | Public YouTube channel URL |
| `youtubeVisible` | boolean | Show the YouTube icon in the website footer |
| `x` | string | Public X (Twitter) profile URL |
| `xVisible` | boolean | Show the X icon in the website footer |

Each social platform is opted into the public website footer icon row per-platform via its `*Visible` flag. A platform that is visible but has no URL set renders as a disabled (non-clickable) icon.

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
    "avatarUrl": null,
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

Self-service update of the caller's own record. Any omitted field is left unchanged. Email, role, and status stay admin-managed.

**Request**

```json
{
  "name": "Anna Nguyen",
  "phone": "+1 555 0123",
  "specializations": ["HAIR", "MAKEUP"],
  "availableForBooking": true,
  "avatarUrl": "https://cdn.example.com/staff/42/avatar.jpg",
  "bio": "Bridal and editorial specialist.",
  "workMedia": [
    "https://cdn.example.com/staff/42/work-1.jpg",
    "https://cdn.example.com/staff/42/reel.mp4"
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `avatarUrl` | string | Profile photo (avatar). |
| `bio` | string | Free-text "About me" blurb shown on the public website. |
| `workMedia` | array | Image or video URLs of the staff member's work, shown on the public website. |

**Response** `200 OK` — `StaffMember`

---

### Get a photo/video upload URL

`POST /api/salon-staff/{staffId}/photo-upload-url`

Returns a pre-signed PUT URL the browser uses to upload a file directly to object storage — S3, Azure Blob Storage, or the backend itself in local dev — depending on `STORAGE_TYPE`. The client PUTs the file to `presignedUrl` with the matching `Content-Type` header (**and `x-ms-blob-type: BlockBlob` when the URL is an Azure Blob endpoint**), then saves `publicUrl` on the staff profile via `PATCH /profile` — as `avatarUrl` (profile photo) or appended to `workMedia` (work gallery). `contentType` accepts `image/*` and `video/*` (`video/mp4`, `video/webm`, `video/quicktime`). The same endpoint exists under `/api/salon-admin/{salonId}/staff/{staffId}/photo-upload-url` for admins.

**Request**

```json
{ "contentType": "video/mp4" }
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
