# Security Audit — Endpoint & Authorization Review

Reviewed: 2026-08-21. Static review of every endpoint in [`oas/OAS.yaml`](../oas/OAS.yaml) against its implementation
under `src/main`, focused on authentication, tenant/object-level authorization, and injection risk. No dynamic/runtime
testing was performed. Line references point at the reviewed revision and may drift with future commits.

Full findings are also published as an artifact: https://claude.ai/code/artifact/9d1db55a-dc2e-4a13-9e25-53c716b368d1

**Summary: 2 Critical (fixed 2026-08-22), 2 High, 3 Medium, plus documentation drift.**

**Update 2026-08-22:** both Critical findings (1 and 2) have been fixed — see the "Fixed" note under each. The
remaining High/Medium findings and the documentation drift are still open.

---

## Follow-up fix — Owners could not sign in to the Staff Portal (found & fixed 2026-08-22)

Not part of the original audit — found while reviewing finding 1's fix, and fixed the same day.

A salon owner is auto-enrolled into `staff_member` on salon creation (`OwnerStaffListener.onSalonCreated` →
`onboardOwner`, role `MANAGER`, `is_owner=true`), and the staff-portal frontend's login picker labels that role
(`ROLE_LABEL.MANAGER`), implying owners are meant to use the same portal for their own bookings/holidays. But the
`user_identity` view (`V1__schema.sql:179-217`) is built with `DISTINCT ON (email, salon_id)` ordered so `OWNER`
(priority 1) beats `STAFF` (priority 2) for the *same* email/salon — its own comment says so explicitly. So
`GET /internal/user-identity` never returns a `STAFF` row for an owner's own salon, the issued JWT's `roles` claim
never contains `STAFF` for them, and the old `hasRole("STAFF")` gate on `/api/salon-staff/**`
(`MultiTenantSalonApplication.java:93`) rejected every owner outright — including `GET /me`, the very first call
the login flow makes.

**Fix:** changed the matcher to `hasAnyRole("STAFF", "OWNER")`. This is safe on top of finding 1's fix: the
`isOwnStaffId` ownership check in `StaffPortalController` still resolves the caller's actual `staff_member` row(s)
by email regardless of which role got them past the gate, so an owner lands on their own staff record and nothing
else.

**Location:** `MultiTenantSalonApplication.java:92-100`

---

## Follow-up fix — Unconditional dev-mode security bypass found uncommitted (found & fixed 2026-08-26)

Not part of the original audit — found while implementing an unrelated feature (the Gen UI chat) and reviewing
`git status`/`git diff` before finishing up. `httpSecurityCustomizer()` had an uncommitted local change:

```java
if (Boolean.TRUE) {
    log.warn("Running in local dev mode; disabling security for convenience");
    return http -> http.csrf(AbstractHttpConfigurer::disable)
            .authorizeHttpRequests(authH -> authH.requestMatchers("/**").permitAll());
}
```

**Impact:** unconditionally `permitAll()`'d on `/**` — not scoped to any environment check, so every namespace
including `/api/salon-super-admin/**` and `/api/salon-admin/{salonId}/**` (both otherwise strongly enforced, see
"What's already solid" below) would have been wide open had this ever reached a commit or a real deployment.

**Fix:** replaced the unconditional bypass with a check on whether `spring.security.oauth2.resourceserver.jwt.issuer-uri`
is still its `application.yaml` default (`http://localhost:9000`, i.e. `OAUTH2_ISSUER_URI` was never set):

```java
if (issuerUri.contains("localhost")) {
    log.warn("No OAuth2 issuer configured (still the localhost default) — running with security disabled for local development.");
    return http -> ...permitAll...
}
```

Deliberately **not** implemented as a check against the incoming request's `Host` header — that would be
spoofable (anyone could send `Host: localhost` to a real deployed instance and bypass auth). Gating on whether a
real issuer was ever configured is a startup-time-only signal outside any request's control, and a real deployment
already has to set `OAUTH2_ISSUER_URI` to an actual issuer for JWT validation to function at all, so the check is
correct in both directions with no extra configuration needed.

**Location:** `MultiTenantSalonApplication.java:76-83`

---

## Headline

The tenant boundary is real and well-built: `/api/salon-admin/{salonId}/**` is guarded by a custom
`AuthorizationManager` that reads the caller's `salons` JWT claim and checks for an `OWNER` role tied to that
exact salon — including a code comment explaining why matcher order matters
(`MultiTenantSalonApplication.java:101-119`). That's the opposite of what the OAS spec itself claims
("Bearer auth not yet enforced ... salonId is the only enforcement in place").

The gaps sit elsewhere: the **staff-portal boundary checks role but not identity**, the **local photo-upload
endpoint has no auth at all**, and **one onboarding endpoint publishes every tenant's data** to the open internet.

---

## Findings

### 1. Staff portal has no object-level ownership check — Critical (BOLA) — ✅ Fixed 2026-08-22

The security config protects `/api/salon-staff/**` with `hasRole("STAFF")` only. Every route under it that takes
a `{staffId}` path variable — profile, appointments, personal holidays, photo-upload — never checks that
`{staffId}` belongs to the caller. Compare this to the admin routes one block above it in the same file, which
resolve the caller's own salon from the JWT and reject a mismatch. No equivalent check exists for staff identity
anywhere in the call path (`StaffPortalController` → `StaffService.updateProfile`, which filters by nothing but
the raw ID).

**Impact:** any authenticated staff member, at any salon, can read another staff member's contact details and
full appointment book (customer names, emails, phone numbers), edit their profile or availability, request a
photo-upload URL on their behalf, or add/remove their personal holidays — simply by iterating `staffId` values.

**Locations:**
- `MultiTenantSalonApplication.java:93`
- `staffportal/internal/StaffPortalController.java:81-151`
- `staff/internal/StaffService.java:56-70` (`updateProfile`)

**Fix:** mirror the admin pattern — resolve the caller's own staff id(s) from the JWT (the way `/me` already does
via `jwt.getSubject()`) and reject any request where the path `staffId` isn't in that set, either in a custom
`AuthorizationManager` matcher or as a check inside each controller method.

**Fixed:** `StaffPortalController` now takes `@AuthenticationPrincipal Jwt jwt` on every `{staffId}`-scoped route
(profile, photo-upload, appointments, holidays) and calls a new `isOwnStaffId(jwt, staffId)` helper — it resolves
the caller's own staff record(s) via `staffApi.findByEmail(jwt.getSubject())` and returns `403 Forbidden` unless
the path `staffId` is one of them. Same "identity from the token" rule `/me` already followed, now applied
consistently across the rest of the portal.

### 2. Photo-upload endpoint accepts unauthenticated writes — Critical (Broken auth) — ✅ Fixed 2026-08-22

`/api/media/photos/**` is fully `permitAll`, and that includes `PUT /api/media/photos/upload/{encodedKey}` —
meant to stand in for an S3 pre-signed URL in local/dev mode. A real pre-signed URL carries a signature the
storage layer verifies; this one is just a path containing a random UUID, and the endpoint never checks that the
key was actually issued by `generateStaffPhotoUploadUrl`. Path traversal is correctly blocked (`resolve()`
normalizes and checks the root prefix), but nothing else is.

**Impact:** anyone, without a token, can write files to `uploads/profile/{any staffId}/...` and have them served
straight back at a public URL — no size or content-type limit, so this doubles as a disk-fill denial-of-service
and free content hosting off the app's own origin. Paired with finding 1, it also lets an attacker overwrite
another staff member's photo end-to-end.

**Locations:**
- `MultiTenantSalonApplication.java:90`
- `media/internal/MediaServiceController.java:29-41`

**Fix:** issue a signed, single-use token as part of `PresignedUpload` and verify it on the PUT; add a
content-type allow-list and a max body size. This gap disappears once `STORAGE_TYPE=S3` is used in production,
since S3 enforces the signature — but the local implementation is exactly this open today, and nothing stops it
from being used in a non-local environment.

**Fixed:** added `LocalMediaUploadSigner`, which HMAC-signs each local-mode upload URL with a 15-minute expiry
(`?expires=...&signature=...`, `media/internal/LocalMediaUploadSigner.java`). `LocalMediaServiceImpl` embeds the
signature when it issues the URL; `MediaServiceController.upload` verifies it before writing and returns `403` on
a bad/missing/expired signature. Uploads are also capped at 5 MB (`413` otherwise). The signing secret is
configurable via `MEDIA_UPLOAD_SIGNING_SECRET` (see `application.yaml`); set it explicitly for any
multi-instance deployment, since an unset secret falls back to a random value generated per instance.

### 3. Full tenant directory is public — High (Data exposure)

`GET /api/salon-onboarding` (`listSalons`) sits under the `/api/salon-onboarding/**` permit-all matcher alongside
the actual public registration form, and returns every `Salon` record on the platform — owner name, email,
phone, contact info, business registration ID, operating hours — to any unauthenticated caller.

**Impact:** complete cross-tenant enumeration of salon owners' PII and business registration numbers; a scraping
target for phishing or competitive intelligence. The OAS spec doesn't flag this endpoint as sensitive either, so
it reads as intentional rather than an oversight.

**Locations:**
- `MultiTenantSalonApplication.java:88`
- `salon/internal/SalonController.java:73-76`

**Fix:** if a public salon directory is a real product need, return a trimmed public projection (name, handler,
city) instead of the full `Salon` record; otherwise move it behind `hasRole("SUPER_ADMIN")` next to its
near-duplicate, `GET /api/salon-super-admin/salons`.

### 4. Internal identity lookup has no defense-in-depth — High (Network-only control)

`GET /internal/user-identity` resolves roles and salon associations by email for the Authorization Server, and
is permit-all inside the app (`MultiTenantSalonApplication.java:91`). The OAS description says this path is
"NOT exposed through the public API Gateway" and "must be protected at the network/IAM layer" — meaning the
application itself does nothing to protect it; the entire control lives in infrastructure this repo doesn't
contain.

**Impact:** if the gateway route is ever misconfigured, exposed by a new ingress path, or bypassed by anything
inside the same network, this becomes an open oracle for "does this email exist, and what roles/salons does it
hold" — account enumeration plus role disclosure, with no in-app fallback.

**Locations:**
- `MultiTenantSalonApplication.java:91`
- `identity/internal/UserIdentityController.java`

**Fix:** add a shared-secret header or mTLS check inside the app as a second layer, so the endpoint is safe even
if the network boundary fails — the same idea already applied to every other trust boundary in this app.

### 5. Profile photo URL accepted without validation — Medium

Both the staff-portal and admin profile-update endpoints accept an arbitrary `photoUrl` string and store it
verbatim — there's no check that it points at the app's own media service or CDN.

**Impact:** low direct impact today, but it's an open field for tracking pixels or off-platform content if any
client ever renders it outside a strict `<img>` context, and it undermines the intent of routing photo storage
through the media service in the first place.

**Locations:**
- `staffportal/internal/StaffPortalController.java` (`ProfileUpdateRequest`)
- `staff/internal/StaffController.java` (`UpdateRequest`)

**Fix:** restrict accepted values to URLs returned by `MediaService`, or at minimum validate scheme/host against
the configured CDN base URL.

### 6. Booking creation contacts third parties without verifying them — Medium (Abuse vector)

`createBooking` requires only that *an* email or phone be present, never that it belongs to the caller — and a
successful booking immediately fires `BookingCreatedEvent`, which the notification module sends to that address.

**Impact:** anyone can use the public booking endpoint to send notification emails/SMS to an arbitrary third
party repeatedly (booking spam/harassment), or create bookings under someone else's identity with no consent
step.

**Locations:**
- `booking/internal/BookingController.java:47-63`

**Fix:** rate-limit booking creation per IP/salon, and consider requiring confirmation of the contact channel
before the first notification goes out for new customer identities.

### 7. CORS defaults to any origin — Medium (Config default)

`spring.application.cors.allowed-origin-patterns` defaults to `*` with all HTTP methods and the `Authorization`
header allowed. `allowCredentials(false)` keeps browsers from attaching cookies, which is the main mitigating
factor.

**Impact:** any website can call these APIs cross-origin and read JSON responses using a bearer token it has
obtained by other means (e.g. an XSS elsewhere, or a token a user pastes into a malicious tool). Fine as a
local-dev default; risky if it ships unchanged to production.

**Locations:**
- `application.yaml:18`
- `MultiTenantSalonApplication.java:39-52`

**Fix:** set `CORS_ALLOWED_ORIGIN_PATTERNS` to the real front-end origin(s) in every deployed environment; treat
`*` as a local-only value.

---

## Coverage by namespace

| Namespace | Enforcement in code | Verdict |
|---|---|---|
| `/internal/user-identity` | Permit-all in-app; relies on network/IAM layer per its own docs | No app-level backstop |
| `/api/salon-onboarding/**` | Permit-all — includes public registration *and* the full-tenant list endpoint | Over-broad |
| `/api/salon/{salonId}/**` | Permit-all — intentional, customer-facing reads and public booking creation | As designed |
| `/api/salon-admin/my-salons` | Requires authentication; identity taken from JWT `sub`, never from the request | Sound |
| `/api/salon-admin/{salonId}/**` | Custom authorization manager: requires an `OWNER` role tied to the exact `salonId` in the JWT's `salons` claim | Strong |
| `/api/salon-super-admin/**` | `hasRole("SUPER_ADMIN")` — role-only, no per-resource scoping (appropriate: this namespace is cross-tenant by design) | Sound |
| `/api/salon-staff/**` | `hasRole("STAFF")` plus a per-route `isOwnStaffId` check resolving the caller's staffId(s) from the JWT subject | Fixed 2026-08-22 |
| `/api/salon-utility/**` | Permit-all — static reference data (countries/currencies), no sensitivity | As designed |
| `/api/media/photos/**` | Permit-all, but the upload PUT now verifies an HMAC-signed, time-limited signature before writing | Fixed 2026-08-22 |
| `/actuator/**` | Permit-all — exposes `health`, `info`, and `metrics` | Broader than needed |

---

## What's already solid

- **Real per-tenant authorization, not just a comment.** The admin matcher for `/api/salon-admin/{salonId}/**`
  reads the JWT's `salons` claim and checks for an active `OWNER` role scoped to that exact salon — and the code
  documents *why* its matcher must be declared before the catch-all, which is the kind of detail that's usually
  only present after someone has actually been bitten by matcher ordering.
- **Identity comes from the token, not the request, everywhere it matters.** Both `/api/salon-admin/my-salons`
  and `/api/salon-staff/me` take `jwt.getSubject()` as the source of truth and treat the `email` query param as a
  mock-mode fallback only — exactly the right instinct, just not carried through to the rest of the staff-portal
  routes.
- **No SQL injection surface.** The super-admin salon search builds its `LIKE` clauses in SQL with `:q` as a
  bound named parameter, not string concatenation in Java — safe despite the free-text search.
- **Path traversal is handled correctly.** The local media controller normalizes and re-checks every resolved
  path against its storage root before touching the filesystem, on both the read and write side.
- **Consistent salon-scoping at the service layer.** Staff, services, bookings, and availability are all fetched
  via `findByIdAndSalonId`-style methods rather than bare ID lookups, so a valid admin token for one salon can't
  reach another salon's child records even before the HTTP-layer check runs.

---

## Documentation drift (notes, not vulnerabilities)

`oas/OAS.yaml` describes `BearerAuth` as *"Not yet enforced — authentication/authorisation is a planned future
addition,"* with the `salonId` path parameter as "the only enforcement in place." That's no longer true — a
working OAuth2 resource server and a custom per-salon authorization manager are both in place. The spec should be
updated to describe the real enforcement (and to call out the staff-portal gap above, which it currently doesn't
mention at all).

Separately, the spec documents a customer-facing `GET /api/salon/{salonId}/booking/{bookingId}` that has no
matching route in `BookingController` — only the admin-scoped equivalent exists. Good that it was never built
unauthenticated (bookingId is a sequential ID, so a public lookup would have been an IDOR), but the spec and
implementation should be reconciled one way or the other.
