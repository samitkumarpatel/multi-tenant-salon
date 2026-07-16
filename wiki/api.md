# API Reference

Base path: `/api`

All request and response bodies are `application/json`. Saloon IDs are `UUID` strings. Service and staff IDs remain `Long` integers.

---

## Saloons

### Create a saloon

`POST /api/saloons`

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

`Location` header points to the new resource, e.g. `/api/saloons/a1b2c3d4-e5f6-7890-abcd-ef1234567890`.

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "handler": "glamsaloon"
}
```

The `handler` is derived from the saloon name: lowercased, spaces replaced with `-`, and special characters stripped (e.g. `"Glam Saloon!"` → `"glam-saloon"`). It is unique across all saloons. Duplicate saloon names are allowed; when the base handler already exists, a numeric suffix is appended until it is unique (e.g. `"glam-saloon"` → `"glam-saloon-2"` → `"glam-saloon-3"`, etc.).

**Flow**

1. `SaloonController.create()` validates `@NotBlank` on `name`, `ownerName`, `ownerEmail` — returns `400` before reaching the service if any are blank.
2. `SaloonService.create()` calls `deriveUniqueHandler(name)`: strips the name to a base slug, then checks `SaloonRepository.existsByHandler(base)`. If taken, it increments a numeric suffix (`-2`, `-3`, …) until a free handler is found. Converts `List<SaloonFeature>` → `List<SaloonFeatureRef>` and builds a `Saloon` with `id = null`.
3. `SaloonRepository.save(Saloon)` → **DB**: `INSERT INTO saloon`, `INSERT INTO saloon_operating_hours`, `INSERT INTO saloon_feature` — all in one transaction. The database assigns the UUID via `DEFAULT gen_random_uuid()`.
4. `ApplicationEventPublisher.publishEvent(SaloonCreatedEvent)` → **DB**: Spring Modulith writes the event to the `event_publication` table before the transaction commits, guaranteeing delivery.
5. `SaloonController.create()` returns `201 Created` with `CreateSaloonResponse(id, handler)` and a `Location` header.
6. After commit → **Event**: `SaloonNotificationListener.onSaloonCreated(SaloonCreatedEvent)` is invoked asynchronously by Spring Modulith.

---

### List all saloons

`GET /api/saloons`

**Response** `200 OK`

```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Glam Saloon",
    "handler": "glamsaloon",
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
2. **DB**: `SELECT * FROM saloon` + child rows from `saloon_operating_hours` and `saloon_feature` per aggregate. `@Embedded` columns are hydrated into `Owner`, `Location`, and `ContactInfo`.
3. Returns `List<Saloon>` — empty array if no saloons exist.

---

### Get a saloon

`GET /api/saloons/{id}`

**Response** `200 OK` — full saloon object (includes `id`, `name`, `handler`, `owner`, `location`, `contact`, `operatingHours`, `features`, `createdAt`)

**Response** `404 Not Found` — if the UUID does not exist

**Flow**

1. `SaloonController.findById(UUID)` → `SaloonService.findById(UUID)` → `SaloonRepository.findById(UUID)`
2. **DB**: `SELECT * FROM saloon WHERE id = ?` + child collections.
3. `SaloonController` maps `Optional<Saloon>` → `200 OK` or `404 Not Found`.

---

### Get a saloon by handler

`GET /api/saloons/handler/{handler}`

**Response** `200 OK` — full saloon object (same shape as [Get a saloon](#get-a-saloon))

**Response** `404 Not Found` — if no saloon with that handler exists

**Flow**

1. `SaloonController.findByHandler(String)` → `SaloonService.findByHandler(String)` → `SaloonRepository.findByHandler(String)`
2. **DB**: `SELECT * FROM saloon WHERE handler = ?` + child collections.
3. `SaloonController` maps `Optional<Saloon>` → `200 OK` or `404 Not Found`.

---

### Update a saloon

`PUT /api/saloons/{id}`

Updates name, location, contact, and operating hours. Owner, handler, and features are preserved from the existing record.

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
2. `SaloonRepository.findById(UUID)` → **DB**: `SELECT * FROM saloon WHERE id = ?` — returns `404` if empty.
3. `SaloonService` builds a new `Saloon` record preserving `id`, `handler`, `owner`, `features`, `createdAt`; replacing `name`, `location`, `contact`, `operatingHours`.
4. `SaloonRepository.save(Saloon)` → **DB**: `UPDATE saloon SET ...` + `DELETE FROM saloon_operating_hours WHERE saloon_id = ?` + re-`INSERT`.
5. Returns `200 OK` with the updated saloon.

---

### Update features

`PUT /api/saloons/{id}/features`

Replaces the full feature list for a saloon.

**Request**

```json
["BOOKING", "MEMBERSHIP", "WEBSHOP"]
```

**Response** `200 OK` — updated saloon object

**Response** `404 Not Found`

**Flow**

1. `SaloonController.updateFeatures(UUID, List<SaloonFeature>)` → `SaloonService.updateFeatures(UUID, ...)`
2. `SaloonRepository.findById(UUID)` → **DB**: `SELECT * FROM saloon WHERE id = ?` — returns `404` if empty.
3. `SaloonService` builds a new `Saloon` record preserving all fields except `features`.
4. `SaloonRepository.save(Saloon)` → **DB**: `DELETE FROM saloon_feature WHERE saloon_id = ?` + re-`INSERT`.
5. Returns `200 OK` with the updated saloon.

---

### Delete a saloon

`DELETE /api/saloons/{id}`

**Response** `204 No Content`

**Flow**

1. `SaloonController.delete(UUID)` → `SaloonService.delete(UUID)` → `SaloonRepository.deleteById(UUID)`
2. **DB**: `DELETE FROM saloon WHERE id = ?` — `ON DELETE CASCADE` removes rows in `saloon_operating_hours`, `saloon_feature`, `service_item`, and `staff_member` automatically.
3. Always returns `204` — no-op if the UUID does not exist.

---

### Publish website

`POST /api/saloons/{id}/publish`

Triggers an asynchronous website deployment pipeline for the saloon. The saloon must have the `STATIC_WEBSITE` feature enabled — this reflects the owner's opt-in to the website product. The request returns immediately; actual AWS work (S3 deploy, subdomain creation, DNS wiring) is handled out-of-band by the `website` module.

**Response** `202 Accepted` — publish event enqueued

**Response** `404 Not Found` — saloon does not exist

**Response** `422 Unprocessable Entity` — saloon does not have the `STATIC_WEBSITE` feature enabled

**Flow**

1. `SaloonController.publishWebsite(UUID)` → `SaloonService.publishWebsite(UUID)`
2. `SaloonRepository.findById(UUID)` — returns `NOT_FOUND` (→ `404`) if not found.
3. `SaloonService` checks `saloon.features()` for `STATIC_WEBSITE` — returns `FEATURE_NOT_ENABLED` (→ `422`) if absent.
4. `ApplicationEventPublisher.publishEvent(WebsitePublishRequestedEvent)` → **DB**: Spring Modulith writes the event to `event_publication` before the transaction commits.
5. Returns `202 Accepted` (no response body).
6. After commit → **Event**: `WebsitePublishListener.onWebsitePublishRequested(WebsitePublishRequestedEvent)` is invoked asynchronously by the `website` module. Currently logs the intent; AWS pipeline integration is pending.

---

## Services

Services are scoped to a saloon via the path. A service can only be retrieved, updated, or deleted through its owning saloon.

### List services

`GET /api/saloons/{saloonId}/services`

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
  }
]
```

**Flow**

1. `SaloonServiceController.findAll(UUID)` → `SaloonServiceManager.findBySaloonId(UUID)` → `SaloonServiceRepository.findBySaloonId(UUID)`
2. **DB**: `SELECT * FROM service_item WHERE saloon_id = ?` + `service_item_assigned_staff` rows per item.
3. Returns `List<ServiceItem>` — empty array if none.

---

### Add a service

`POST /api/saloons/{saloonId}/services`

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
| `price` | decimal | no | |
| `currency` | string | no | ISO 4217, e.g. `"USD"` |
| `durationMinutes` | int | no | |
| `category` | string | yes | See [ServiceCategory](#servicecategory) values |
| `assignedStaffIds` | array | no | IDs of staff members to assign |

**Response** `201 Created`

`Location` header points to the new resource, e.g. `/api/saloons/a1b2c3d4-e5f6-7890-abcd-ef1234567890/services/1`.

```json
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
}
```

**Flow**

1. `SaloonServiceController.add(UUID, AddServiceRequest)` → `SaloonServiceManager.add(UUID, ...)`
2. `SaloonServiceManager` builds a `ServiceItem` with `id = null`, `active = true`, `createdAt = Instant.now()`.
3. `SaloonServiceRepository.save(ServiceItem)` → **DB**: `INSERT INTO service_item` + `INSERT INTO service_item_assigned_staff`.
4. Returns `201 Created` with the saved `ServiceItem` and a `Location` header.

---

### Get a service

`GET /api/saloons/{saloonId}/services/{serviceId}`

**Response** `200 OK` — service object

**Response** `404 Not Found` — if the service does not exist or does not belong to the saloon

**Flow**

1. `SaloonServiceController.findById(UUID, Long)` → `SaloonServiceManager.findById(UUID, Long)`
2. `SaloonServiceRepository.findById(Long)` → **DB**: `SELECT * FROM service_item WHERE id = ?`
3. Result is filtered by `saloonId` — returns `404` if not found or saloon mismatch.

---

### Update a service

`PUT /api/saloons/{saloonId}/services/{serviceId}`

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

All fields are required. Set `active` to `false` to deactivate the service without deleting it.

**Response** `200 OK` — updated service object

**Response** `404 Not Found`

**Flow**

1. `SaloonServiceController.update(UUID, Long, UpdateServiceRequest)` → `SaloonServiceManager.update(UUID, Long, ...)`
2. `SaloonServiceRepository.findById(Long)` → **DB**: `SELECT * FROM service_item WHERE id = ?` — filtered by `saloonId`, returns `404` on mismatch.
3. `SaloonServiceManager` builds a new `ServiceItem` preserving `id`, `saloonId`, `createdAt`.
4. `SaloonServiceRepository.save(ServiceItem)` → **DB**: `UPDATE service_item SET ...` + `DELETE FROM service_item_assigned_staff WHERE service_item_id = ?` + re-`INSERT`.
5. Returns `200 OK` with the updated `ServiceItem`.

---

### Remove a service

`DELETE /api/saloons/{saloonId}/services/{serviceId}`

**Response** `204 No Content`

**Flow**

1. `SaloonServiceController.remove(UUID, Long)` → `SaloonServiceManager.remove(UUID, Long)`
2. `SaloonServiceRepository.findById(Long)` → **DB**: `SELECT * FROM service_item WHERE id = ?` — filtered by `saloonId`. Skips delete silently if not found or wrong saloon.
3. `SaloonServiceRepository.deleteById(Long)` → **DB**: `DELETE FROM service_item WHERE id = ?` — `ON DELETE CASCADE` removes `service_item_assigned_staff` rows.
4. Always returns `204`.

---

## Staff

Staff members are scoped to a saloon via the path. A member can only be retrieved, updated, or deleted through its owning saloon.

### List staff

`GET /api/saloons/{saloonId}/staff`

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
    "specializations": ["coloring", "balayage"],
    "photoUrls": ["https://cdn.example.com/staff/alice-1.jpg", "https://cdn.example.com/staff/alice-2.jpg"],
    "bio": "Alice has 10 years of experience in color and balayage.",
    "createdAt": "2026-07-08T10:00:00Z"
  }
]
```

**Flow**

1. `StaffController.findAll(UUID)` → `StaffService.findBySaloonId(UUID)` → `StaffRepository.findBySaloonId(UUID)`
2. **DB**: `SELECT * FROM staff_member WHERE saloon_id = ?` + `staff_member_specialization` rows per member.
3. Returns `List<StaffMember>` — empty array if none.

---

### Onboard a staff member

`POST /api/saloons/{saloonId}/staff`

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
| `photoUrls` | array | no | One or more photo URLs shown on the public website *(planned — not yet implemented)* |
| `bio` | string | no | Short bio / description shown on the public website *(planned — not yet implemented)* |

New staff members are set to status `ACTIVE` automatically.

**Response** `201 Created`

`Location` header points to the new resource, e.g. `/api/saloons/a1b2c3d4-e5f6-7890-abcd-ef1234567890/staff/1`.

```json
{
  "id": 1,
  "saloonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Alice Smith",
  "email": "alice@glamsaloon.com",
  "phone": "+1234567890",
  "role": "STYLIST",
  "status": "ACTIVE",
  "specializations": ["coloring", "balayage"],
  "photoUrls": ["https://cdn.example.com/staff/alice-1.jpg"],
  "bio": "Alice has 10 years of experience in color and balayage.",
  "createdAt": "2026-07-08T10:00:00Z"
}
```

**Flow**

1. `StaffController.onboard(UUID, OnboardRequest)` → `StaffService.onboard(UUID, ...)`
2. `StaffService` builds a `StaffMember` with `id = null`, `status = ACTIVE`, `createdAt = Instant.now()`.
3. `StaffRepository.save(StaffMember)` → **DB**: `INSERT INTO staff_member` + `INSERT INTO staff_member_specialization`.
4. Returns `201 Created` with the saved `StaffMember` and a `Location` header.

---

### Get a staff member

`GET /api/saloons/{saloonId}/staff/{staffId}`

**Response** `200 OK` — staff member object

**Response** `404 Not Found` — if the staff member does not exist or does not belong to the saloon

**Flow**

1. `StaffController.findById(UUID, Long)` → `StaffService.findById(UUID, Long)`
2. `StaffRepository.findById(Long)` → **DB**: `SELECT * FROM staff_member WHERE id = ?`
3. Result is filtered by `saloonId` — returns `404` if not found or saloon mismatch.

---

### Update a staff member

`PUT /api/saloons/{saloonId}/staff/{staffId}`

**Request**

```json
{
  "name": "Alice Smith",
  "email": "alice@glamsaloon.com",
  "phone": "+1234567890",
  "role": "COLORIST",
  "status": "ON_LEAVE",
  "specializations": ["coloring", "balayage", "highlights"],
  "photoUrls": ["https://cdn.example.com/staff/alice-1.jpg", "https://cdn.example.com/staff/alice-2.jpg"],
  "bio": "Alice has 10 years of experience in color and balayage."
}
```

All fields are required except `photoUrls` and `bio` *(planned — not yet implemented)*. `status` can be changed here (e.g. to `INACTIVE` or `ON_LEAVE`).

**Response** `200 OK` — updated staff member object

**Response** `404 Not Found`

**Flow**

1. `StaffController.update(UUID, Long, UpdateRequest)` → `StaffService.update(UUID, Long, ...)`
2. `StaffRepository.findById(Long)` → **DB**: `SELECT * FROM staff_member WHERE id = ?` — filtered by `saloonId`, returns `404` on mismatch.
3. `StaffService` builds a new `StaffMember` preserving `id`, `saloonId`, `createdAt` — all other fields including `status` are replaced.
4. `StaffRepository.save(StaffMember)` → **DB**: `UPDATE staff_member SET ...` + `DELETE FROM staff_member_specialization WHERE staff_member_id = ?` + re-`INSERT`.
5. Returns `200 OK` with the updated `StaffMember`.

---

### Remove a staff member

`DELETE /api/saloons/{saloonId}/staff/{staffId}`

**Response** `204 No Content`

**Flow**

1. `StaffController.remove(UUID, Long)` → `StaffService.remove(UUID, Long)`
2. `StaffRepository.findById(Long)` → **DB**: `SELECT * FROM staff_member WHERE id = ?` — filtered by `saloonId`. Skips delete silently if not found or wrong saloon.
3. `StaffRepository.deleteById(Long)` → **DB**: `DELETE FROM staff_member WHERE id = ?` — `ON DELETE CASCADE` removes `staff_member_specialization` rows.
4. Always returns `204`.

---

## Website Theme

Theme settings are scoped to a saloon and control the visual appearance of its public-facing website. A theme is automatically initialised with sensible defaults on first read — no explicit creation step is required.

### Get theme

`GET /api/saloons/{id}/theme`

**Response** `200 OK`

```json
{
  "saloonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "heroBg": "#0F172A",
  "heroTextColor": "#FFFFFF",
  "accentColor": "#F59E0B",
  "fontFamily": "inter",
  "logoBgColor": "#F59E0B",
  "updatedAt": null
}
```

`updatedAt` is `null` when the theme has never been explicitly saved (defaults are returned in-memory).

**Flow**

1. `WebsiteController.getTheme(UUID)` → `WebsiteThemeService.getTheme(UUID)` → `WebsiteThemeRepository.findById(UUID)`
2. **DB**: `SELECT * FROM saloon_website_theme WHERE saloon_id = ?`
3. If no row exists, returns a hard-coded default `WebsiteTheme` (no DB write) — `heroBg="#0F172A"`, `heroTextColor="#FFFFFF"`, `accentColor="#F59E0B"`, `fontFamily="inter"`, `logoBgColor="#F59E0B"`, `updatedAt=null`.

---

### Save theme

`PUT /api/saloons/{id}/theme`

Creates or fully replaces the theme for a saloon (`ON CONFLICT DO UPDATE`).

**Request**

```json
{
  "heroBg": "#1E293B",
  "heroTextColor": "#F8FAFC",
  "accentColor": "#6366F1",
  "fontFamily": "poppins",
  "logoBgColor": "#6366F1"
}
```

| Field | Type | Notes |
|---|---|---|
| `heroBg` | string | CSS color for the hero section background |
| `heroTextColor` | string | CSS color for hero text |
| `accentColor` | string | Primary accent / CTA color |
| `fontFamily` | string | Font family slug (e.g. `"inter"`, `"poppins"`) |
| `logoBgColor` | string | Background color behind the saloon logo |

**Response** `200 OK`

```json
{
  "saloonId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "heroBg": "#1E293B",
  "heroTextColor": "#F8FAFC",
  "accentColor": "#6366F1",
  "fontFamily": "poppins",
  "logoBgColor": "#6366F1",
  "updatedAt": "2026-07-08T12:00:00Z"
}
```

**Flow**

1. `WebsiteController.saveTheme(UUID, SaveThemeRequest)` → `WebsiteThemeService.saveTheme(UUID, ...)`
2. **DB**: `INSERT INTO saloon_website_theme (...) VALUES (...) ON CONFLICT (saloon_id) DO UPDATE SET ...` with `updated_at = NOW()`.
3. `WebsiteThemeRepository.findById(UUID)` re-fetches the persisted row and returns `200 OK`.

---

## Utility

### List countries

`GET /api/utility/countries`

Returns the full list of countries with their ISO codes and dial codes. The data is loaded from a static classpath resource at startup — no database access occurs on this endpoint.

**Response** `200 OK`

```json
[
  { "name": "United States", "code": "US", "dialCode": "+1" },
  { "name": "India",         "code": "IN", "dialCode": "+91" }
]
```

| Field | Type | Notes |
|---|---|---|
| `name` | string | Full country name |
| `code` | string | ISO 3166-1 alpha-2 code |
| `dialCode` | string | International dialling prefix (e.g. `"+1"`) |

**Flow**

1. `UtilityController.countries()` → `CountryService.findAll()`
2. `CountryService` loads data from `${spring.application.utility.static-geo-data}` (a JSON classpath resource) at startup via Jackson; subsequent calls read from the in-memory list.
3. Returns `List<Country>` — always non-null; empty if the resource contained no entries.

---

### List currencies

`GET /api/utility/currencies`

Returns the full list of ISO 4217 currencies with their codes, names, and symbols. The data is loaded from a static classpath resource at startup — no database access occurs on this endpoint.

**Response** `200 OK`

```json
[
  { "code": "USD", "name": "United States Dollar", "symbol": "$"  },
  { "code": "EUR", "name": "Euro",                 "symbol": "€" },
  { "code": "INR", "name": "Indian Rupee",         "symbol": "₹" }
]
```

| Field | Type | Notes |
|---|---|---|
| `code` | string | ISO 4217 currency code (e.g. `"USD"`) |
| `name` | string | Full currency name |
| `symbol` | string | Currency symbol (e.g. `"$"`, `"€"`) |

**Flow**

1. `UtilityController.currencies()` → `CurrencyService.findAll()`
2. `CurrencyService` loads data from `${spring.application.utility.static-currency-data}` (a JSON classpath resource) at startup via Jackson; subsequent calls read from the in-memory list.
3. Returns `List<Currency>` — always non-null; empty if the resource contained no entries.

---

## Reference

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
