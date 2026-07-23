# OAS Review Findings

Reviewed: 2026-07-21  
Spec version: `oas/OAS.yaml` v2.0.0 (OpenAPI 3.1.0)

Status legend: ✅ Fixed | 🔲 Open

---

## Must Fix (spec correctness)

| # | Status | Finding | Location |
|---|--------|---------|----------|
| M1 | ✅ | `nullable: true` is not valid in OpenAPI 3.1. Replaced with `type: [string, "null"]`. | `StaffAvailabilityOverride.startTime/endTime`, `AddOverrideRequest.startTime/endTime` |
| M2 | ✅ | `format: decimal` is not a standard OAS format. Removed the format field; `type: number` is sufficient. See DB schema `NUMERIC(10,2)` for actual precision. | `ServiceItem.price`, `AddServiceRequest.price`, `UpdateServiceRequest.price` |
| M3 | 🔲 | Admin endpoints have no `security:` applied despite `BearerAuth` being defined in `securitySchemes`. Deferred — auth enforcement is planned for a future phase. When ready, add `security: [{BearerAuth: []}]` to all 32 `/api/saloon-admin/…` operations. | All `/api/saloon-admin/…` operations |
| M4 | ✅ | `/api/saloon/{saloonId}/booking/slots` declared `SaloonId` as an operation-level parameter instead of a path-item-level parameter like every other `{saloonId}` path. Moved to `parameters:` at the path item level. | `paths./api/saloon/{saloonId}/booking/slots` |
| M5 | 🔲 | `assignedStaffIds` items are `type: string` in OAS (matching the current `VARCHAR(255)` DB column and `String staffId` in `AssignedStaff` record). However, `StaffMember.id` is `BIGSERIAL`/`Long`. The backend currently serializes numeric staff IDs as strings — this is a **backend data-model design issue** that should be addressed separately: migrate `service_item_assigned_staff.staff_id` to `BIGINT` and update the `AssignedStaff` wrapper to use `Long`. Once done, update OAS items to `type: integer, format: int64`. | `ServiceItem.assignedStaffIds`, `AddServiceRequest.assignedStaffIds`, `UpdateServiceRequest.assignedStaffIds` |

---

## Should Fix (missing response coverage)

| # | Status | Finding | Affected operations |
|---|--------|---------|---------------------|
| S1 | 🔲 | No `400 Bad Request` response documented on any POST/PUT endpoint. Add a shared `BadRequest` response component referencing `ProblemDetail` (RFC 9457, supported natively by Spring Boot 4). | `createSaloon`, `createBooking`, `onboardStaff`, `addService`, `updateService`, `setStaffAvailability`, `addAvailabilityOverride`, `saveTheme`, `updateWebsiteType`, `rescheduleBooking`, `updateSaloon`, `updateSaloonFeatures`, `updateStaffMember` |
| S2 | 🔲 | `deleteBooking` is missing a `404` response. All other delete operations (`deleteService`, `deleteStaffMember`) include it. | `deleteBooking` |
| S3 | 🔲 | Error responses have no body schema. A `NotFound` 404 currently has no `content:` block — clients cannot parse error details. Add a `ProblemDetail` schema (RFC 9457) and reference it from `NotFound`, `BadRequest`, and a new `Conflict` component. | All `$ref: "#/components/responses/NotFound"` usages |
| S4 | 🔲 | No `default` (5xx) response documented on any operation. Consider a shared `InternalServerError` component. | All operations |

---

## Nice to Have (quality improvements)

| # | Status | Finding |
|---|--------|---------|
| N1 | 🔲 | No field-level validation constraints (`minLength`, `maxLength`, `pattern`) on string fields like `name`, `ownerEmail`, `handler`, `phone`. Code generators produce no validation; API consumers have no documented limits. |
| N2 | 🔲 | `CreateSaloonResponse` only returns `{id, handler}`. Since the `Location` header is already set, returning the full `Saloon` object would be more consistent with every other create operation and eliminates the bespoke one-off schema. |
| N3 | 🔲 | Response schemas have no `required` arrays (`Saloon`, `StaffMember`, `Booking`, `ServiceItem`, etc.). Generators treat all fields as optional, weakening client type safety. |
| N4 | 🔲 | List endpoints (`listSaloons`, `listServices`, `listStaff`, `listBookings`) return unbounded arrays. Add `page`/`size` query parameters or cursor-based pagination, especially for `listBookings`. |
| N5 | 🔲 | `info` block is missing `contact` and `license` fields. Useful for developer portals and tooling. |
| N6 | 🔲 | `GET /api/saloon-admin/{saloonId}/website-type` returns `WebsiteTypeResponse` — a one-field wrapper that is a strict subset of `WebsiteTheme` (which already contains `websiteType`). Consider reusing or referencing the full theme or factoring out a common subset. |
| N7 | 🔲 | Schema examples are sparse. Most request/response schemas only have examples at the field level for a few string fields. Adding `example` objects at the schema level improves readability in rendered docs and in Swagger UI. |
| N8 | 🔲 | No API versioning strategy in paths (`/api/v2/…`). Currently all paths are unversioned, which makes non-backwards-compatible changes breaking. |

---

## Backend Alignment Notes (M1–M4)

All three applied fixes (M1, M2, M4) are **OAS-only corrections** that already match the actual backend implementation:
- `LocalTime startTime/endTime` in `StaffAvailabilityOverride.java` are nullable Java fields — no code change needed.
- `BigDecimal price` in `ServiceItem.java` is unchanged — removing `format: decimal` from OAS does not affect serialization.
- SaloonId parameter placement is a spec formatting fix only; the Spring `@PathVariable` binding is unchanged.

**Frontend type definitions** (`frontend/packages/ui-website/src/types.ts`) already correctly reflect all fixed items:
- `startTime?: string` / `endTime?: string` on `StaffAvailabilityOverride` — optional covers null.
- `price: number` on `ServiceItem` — `type: number` with no format matches `number` in TS.
