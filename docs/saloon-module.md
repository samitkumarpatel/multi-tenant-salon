# Saloon Module

The `saloon` module is the foundation of the multi-tenant SaaS platform. It handles tenant onboarding — a saloon owner registers their business and selects which platform features to activate.

---

## Domain Model

### `Saloon`

Stored in the `saloons` MongoDB collection.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `String` | MongoDB-generated identifier |
| `name` | `String` | Business name of the saloon |
| `owner` | `Owner` | Nested owner contact details |
| `features` | `List<SaloonFeature>` | Active features for this tenant |
| `createdAt` | `Instant` | Registration timestamp (UTC) |

#### `Owner` (nested)

| Field | Type |
|-------|------|
| `name` | `String` |
| `email` | `String` |
| `phone` | `String` |

### `SaloonFeature` (enum)

| Value | Description |
|-------|-------------|
| `STATIC_WEBSITE` | Hosted marketing page for the saloon |
| `BOOKING` | Online appointment booking system |
| `MEMBERSHIP` | Membership and subscription management |
| `WEBSHOP` | E-commerce / product shop |
| `ANALYTICS` | Business insights and reporting |
| `LOYALTY_PROGRAM` | Customer loyalty and rewards |

---

## REST API

Base path: `/api/saloons`

### Register a saloon

```
POST /api/saloons
Content-Type: application/json
```

**Request body:**
```json
{
  "name": "Glam Saloon",
  "ownerName": "Jane Doe",
  "ownerEmail": "jane@glamsaloon.com",
  "ownerPhone": "+1234567890",
  "features": ["BOOKING", "STATIC_WEBSITE"]
}
```

**Response:** `201 Created` with `Location: /api/saloons/{id}` header and the created saloon body.

```json
{
  "id": "6840e1a2f3b4c5d6e7f80001",
  "name": "Glam Saloon",
  "owner": {
    "name": "Jane Doe",
    "email": "jane@glamsaloon.com",
    "phone": "+1234567890"
  },
  "features": ["BOOKING", "STATIC_WEBSITE"],
  "createdAt": "2026-05-13T15:30:00Z"
}
```

---

### List all saloons

```
GET /api/saloons
```

**Response:** `200 OK` — array of saloon objects.

---

### Get a saloon

```
GET /api/saloons/{id}
```

**Response:** `200 OK` — saloon object, or `404 Not Found`.

---

### Update feature selection

Replaces the full feature list for a saloon.

```
PUT /api/saloons/{id}/features
Content-Type: application/json
```

**Request body:**
```json
{
  "features": ["BOOKING", "MEMBERSHIP", "WEBSHOP"]
}
```

**Response:** `200 OK` — updated saloon object, or `404 Not Found`.

---

### Delete a saloon

```
DELETE /api/saloons/{id}
```

**Response:** `204 No Content`

---

## Events

When a saloon is created, a `SaloonCreatedEvent` is published via Spring's `ApplicationEventPublisher`. Other modules can listen to this event using `@ApplicationEventListener` without creating a direct dependency on the `saloon` module internals.

```java
public record SaloonCreatedEvent(
    String saloonId,
    String saloonName,
    List<SaloonFeature> features
) {}
```

---

## Module Structure

```
saloon/                         ← public API (accessible to other modules)
├── Saloon.java                 record, @Document
├── SaloonFeature.java          enum
├── SaloonCreatedEvent.java     Spring application event
└── internal/                  ← encapsulated; other modules cannot reference these
    ├── SaloonRepository.java   MongoRepository<Saloon, String>
    ├── SaloonService.java      business logic + event publishing
    └── SaloonController.java   @RestController, request records defined inline
```

Spring Modulith enforces that nothing outside the `saloon` package can directly import from `saloon.internal`. Cross-module communication goes through the public types and application events only.

---

## Running Locally

No external setup is required. Running via `./mvnw spring-boot:test-run` starts a MongoDB instance automatically via Testcontainers.

```bash
./mvnw spring-boot:test-run
```

The API will be available at `http://localhost:8080/api/saloons`.

**Example — create a saloon:**
```bash
curl -s -X POST http://localhost:8080/api/saloons \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Saloon",
    "ownerName": "Jane Doe",
    "ownerEmail": "jane@example.com",
    "ownerPhone": "+1234567890",
    "features": ["BOOKING", "STATIC_WEBSITE"]
  }' | jq .
```

**Example — update features:**
```bash
curl -s -X PUT http://localhost:8080/api/saloons/{id}/features \
  -H "Content-Type: application/json" \
  -d '{"features": ["BOOKING", "MEMBERSHIP", "WEBSHOP"]}' | jq .
```
