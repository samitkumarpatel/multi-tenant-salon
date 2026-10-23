# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
# Build
./mvnw clean package

# Run tests (requires Docker for Testcontainers)
./mvnw test

# Run a single test class
./mvnw test -Dtest=MultiTenantSalonApplicationTests

# Run the app in test mode (starts PostgreSQL via Testcontainers)
./mvnw spring-boot:test-run

# Run the app in production mode (requires a running PostgreSQL instance at localhost:5432 or with a real connection string configured in application.yaml)
# Security is ON by default here. Either run the auth server too, or add the `local` profile to turn it off:
./mvnw spring-boot:run
./mvnw spring-boot:run -Dspring-boot.run.profiles=local

# Build native image (requires GraalVM 25+)
./mvnw native:compile -Pnative

# Build OCI container image
./mvnw spring-boot:build-image -Pnative
```

## Stack

- **Java 25**, **Spring Boot 4.1.0**, **Spring Modulith 2.0.6**
- **PostgreSQL** via Spring Data JDBC (`spring-boot-starter-data-jdbc`)
- **Lombok** for boilerplate reduction
- **Testcontainers** (`postgres:latest`) for integration tests — tests hit a real PostgreSQL container, not mocks
- GraalVM Native Image support configured via `native-maven-plugin`

## Architecture

This is a **modular monolith** using [Spring Modulith](https://docs.spring.io/spring-modulith/reference/). Modules are enforced as Java packages under `net.samitkumar.multi_tenant_salon`. Each top-level sub-package is treated as an independent module with enforced boundaries.

The application is a **multi-tenant SaaS platform for salon/salon management**. The architecture diagram is in `others/salon_saas_architecture.svg`.

Key conventions:
- Module internals go in sub-packages (e.g., `module.internal`) and are not accessible to other modules
- Cross-module communication uses Spring application events (see "Reliable events" below); a module may also call another module's *public* API interface (`SalonApi`, `PaymentGateway`, …), never its `internal` beans
- `spring-modulith-starter-jdbc` provides event publication with PostgreSQL-backed persistence

### Reliable events (every cross-module event follows this)

- **Publish inside a transaction**, in the same transaction as the business change. Only then does Modulith store the event in `event_publication`, and `@ApplicationModuleListener`s are *not invoked at all* for an event published outside one. `DomainEventTransactionGuard` logs an error in production and fails tests (`app.events.fail-outside-transaction=true` in `src/test/resources/application.properties`) for any of our events published without a transaction. Use `@Transactional` on the publishing service method (not a private/self-invoked one) or a `TransactionTemplate`.
- **Listen with `@ApplicationModuleListener`** — never plain `@EventListener` / `@TransactionalEventListener` across modules. It runs after commit, async, in its own transaction, and its publication is tracked.
- **Let real failures throw.** A listener that throws leaves its publication `FAILED`; `EventPublicationMaintenance` resubmits failed ones with exponential backoff (`app.events.retry.*`: max attempts, max age, backoff) and reports the ones it gave up on. Swallow only *permanent* failures that a retry can't fix (e.g. Mailjet 4xx, malformed metadata). Stuck deliveries (app stopped mid-listener) are marked failed by `spring.modulith.events.staleness.*` and retried the same way.
- **Listeners must be idempotent** — delivery is at-least-once (conditional `UPDATE … WHERE status = 'PENDING'`, "skip if already seeded", etc.). Where an async listener and a request can write the same rows, serialize them (e.g. `booking.internal.StaffScheduleLock`).
- Delivered publications are archived (`completion-mode: archive` → `event_publication_archive`) and pruned after `app.events.archive-retention`.
- **Tests** publish inside a `TransactionTemplate` and wait for delivery (a delivered publication leaves `event_publication`) — see `NotificationModuleTests.publishAndAwaitDelivery` and `NotificationRetryIntegrationTest`.
- Synchronous calls through another module's public API (`SalonApi`, `PaymentGateway.createCheckout`, …) are fine when the caller needs an answer straight away; state changes that other modules react to go through events.

## Modules

- **`salon`** — Core aggregate: `Salon` entity with embedded `Owner`/`Location`/`ContactInfo` and child tables for `operatingHours`/`features`. Publishes `SalonCreatedEvent`.
- **`salonservice`** — `ServiceItem` catalog per salon (pricing, duration, category, assigned staff).
- **`staff`** — `StaffMember` roster per salon (role, status, specializations).
- **`shop`** — Web-shop for the `WEBSHOP` feature. Per-salon `Brand` / `Category` / `Product`, with `ProductVariant` as a **separate aggregate** (its own table, keyed by order lines + inventory — never a `@MappedCollection`, so a product edit can't renumber variant rows). A product carries an ordered image gallery (`product_image` child table, `@MappedCollection` — nothing FKs it so re-insert on save is fine); `product.image_url` stays as the cover and always mirrors `images[0]`. Stock lives on the variant; checkout does an atomic conditional `UPDATE` to decrement it. Each variant has a required `weightGrams` (estimated from its label by `VariantWeights` when omitted) and a currency that defaults to the salon's (`ShopCurrency`, from the country name in `location.country`); one product and one cart use one currency. `ShippingMethod` (Shipmondo-style rules: countries, order value, item count, weight bracket, currency, free-over) is evaluated by `ShippingMethodService` for both the storefront quote and `placeOrder`, so the shipping shown is the shipping charged. `ShopOrder` → `OrderLine` is written once at checkout; `OrderLineActivity` is a separate aggregate (insert-only) so the per-line timeline survives status updates. Payment is a dummy step (`placeOrder` returns the order `PAID`). Publishes `OrderPlacedEvent`, `OrderStatusChangedEvent`, `OrderLineActivityAddedEvent`, and listens for `OrderCustomerNotifiedEvent` (the notification module's send acknowledgement — see below) to append the exact customer email to the order's `CUSTOMER_NOTIFIED` activity timeline.
- **`membership`** — `MEMBERSHIP` feature. Per-salon `MembershipPlan` (perks + included services as `@MappedCollection` child tables; `DRAFT`/`ACTIVE`/`ARCHIVED` — a plan with members can only be archived) and `MembershipSubscription`, a **separate aggregate** that snapshots price/interval at purchase and is only ever changed by conditional `UPDATE`s. Paid **the same way as the shop and the till**: each billing period is one `MembershipPayment` (sign-up or renewal) and one one-time `PaymentGateway.createCheckout(salonId, CheckoutRequest("MEMBERSHIP", <paymentId>, …))`; `MembershipEventListeners` handles `StripePaymentEvent` for that area and calls `recordStripePayment`, which moves only `PENDING` payments and extends `currentPeriodEnd` by one interval. Nothing renews automatically — `processRenewals` (`@Scheduled`, `spring.application.membership.*`) emails a renewal link (`renewalToken`) before the end and flips lapsed members to `EXPIRED` (or `CANCELLED` if the salon scheduled it). Statuses `PENDING_PAYMENT → ACTIVE → EXPIRED/CANCELLED`, `INCOMPLETE` for an abandoned first checkout. Admin cancellation needs no Stripe call. The salon desk (`salon-dashboard`) checks members in by QR/code and sells memberships via `POST …/membership/desk-sales`: `CASH`/`OTHER` settle the payment on the spot (`membership_payment.method`), `CARD` is either a card reader (`terminalId` → `PaymentGateway.collectOnTerminal`) or the same Stripe Checkout returning to the desk.

## Security: local vs. deployed

The API is **fail-closed**. `app.security.permit-all` (default `false`) is what opens it, and only
while the OAuth2 issuer is still the `localhost` default — so neither an unset issuer nor a stray
flag alone can serve the owner API unauthenticated, and a real issuer always wins.

| Where | How |
|---|---|
| `spring-boot:test-run` and all tests | `app.security.permit-all=true` in `src/test/resources/application.properties` |
| `spring-boot:run` locally | add `-Dspring-boot.run.profiles=local` (`application-local.yaml`), or run the auth server and leave security on |
| Deployed | neither is set, so the real JWT chain applies. `OAUTH2_ISSUER_URI` is set in `helm/api/values.yaml` and the Terraform container app |

`/internal/user-identity` is reachable without a token because the Authorization Server calls it
while issuing a JWT. Set `spring.application.identity.internal-api-key` here and send it as
`X-Internal-Api-Key` from the auth server; unset, it logs a warning on every startup and stays open.

## Desk access for staff

The owner API `/api/salon-admin/{salonId}/**` is owner-only, except that `SalonDeskAccess` (root package, wired into the security rule) lets a salon's **active staff** call the allowlisted endpoints the desk app uses — only for a salon their token names, re-checked live against `user_identity`, and only when the salon has DASHBOARD. A new desk feature that calls another owner endpoint must be added to that allowlist (and `SalonDeskAccessIntegrationTest`). The desk login lists salons via `GET /api/salon-admin/my-desk-salons` (owned + active-staff salons); `my-salons` stays owner-only for the admin app. Sign-ups on capped plans are serialized with `pg_advisory_xact_lock(-7301, planId)`. Publishes `MembershipActivatedEvent` (welcome/renewed email with the QR code of `memberCode`, rendered by `utility.QrCodes`), `MembershipRenewalDueEvent` and `MembershipCancelledEvent`, and records the notification ack `MembershipCustomerNotifiedEvent` on the timeline. Member self-service (cancel from the member side) is not built yet.
- **`payments`** — Stripe Connect (Accounts v2, direct charges on each salon's own account). Public API: `PaymentGateway` (`createCheckout(salonId, CheckoutRequest)` → `Checkout` with the salon's per-area style `REDIRECT`/`EMBEDDED`/`ELEMENTS` — in-page styles only when the client sends `inlineCheckout: true`; `collectOnTerminal` for Stripe Terminal readers (server-driven); `refundIfPaid`) and `StripePaymentEvent` (the outcome every feature module listens to; for readers `checkoutSessionId` carries the PaymentIntent id). Per-area settings live in `salon_payment_area`; every payment attempt is in the `payment` ledger (`PaymentLedger`, conditional `UPDATE … WHERE status = 'PENDING'` so webhook/poll/cancel settle once) with `payment_refund`. Internals: `StripeClient` (all HTTP, pins `Stripe-Version`), `StripeConnectService` (onboarding, settings, checkout, webhook routing, embedded-component account sessions), `StripeTerminalService`, `StripeRefundService`. Card-reader endpoints the desk uses are in the `SalonDeskAccess` allowlist. See `design-n-todo/stripe-connect.md`.
- **`notification`** — Listens to salon/booking/shop domain events (`SalonCreatedEvent`, `SalonUpdatedEvent`, `SalonDisabledEvent`, `BookingCreatedEvent`, `BookingStatusChangedEvent`, `BookingRescheduledEvent`, `StaffBookingAssignedEvent`, `OrderPlacedEvent`, `OrderStatusChangedEvent`, `OrderLineActivityAddedEvent`, `MembershipActivatedEvent`, `MembershipRenewalDueEvent`, `MembershipCancelledEvent`) via `@ApplicationModuleListener` (decoupled, async-safe) and sends email via Mailjet. `notification.internal.NotificationService` is the single entry point all listeners funnel through for composing/dispatching every notification; configured under `spring.application.notification.*` (unset `mailjet.api-key` logs instead of sending — the default for dev/test). After sending a customer-facing order email it publishes `shop.OrderCustomerNotifiedEvent` (an ack event that lives in the `shop` package so the round-trip stays event-driven with no `shop`↔`notification` cycle) carrying the subject/body/status; the `shop` module records it on the order timeline.

## Data Model

Schema lives in `src/main/resources/db/V1__schema.sql`. Spring Boot initializes it on startup (`spring.sql.init.mode: always`).

Spring Data JDBC conventions used throughout:
- All aggregate roots use `@Id Long id` (auto-generated `BIGSERIAL`).
- Nested value objects (`Owner`, `Location`, `ContactInfo`) are `@Embedded` — flattened into the parent table. Columns that would clash (e.g., `owner_email` vs `contact_email`) are disambiguated with `@Column` on the inner record components.
- Collection fields (`operatingHours`, `features`, `assignedStaffIds`, `specializations`) live in separate child tables via `@MappedCollection(idColumn = "...")`.
- Wrapper records for collection elements (`SalonFeatureRef`, `AssignedStaff`, `Specialization`) carry `@JsonValue` so they serialize transparently — e.g., `List<SalonFeatureRef>` serializes as `["BOOKING"]`, not `[{"feature":"BOOKING"}]`.
- any new changes related to db schema ha to be in a separate file with a versioned name like `V2__add_new_table.sql` and so on.

## Testing

The `TestcontainersConfiguration` class auto-wires a PostgreSQL container for any test that `@Import`s it. The `TestMultiTenantSalonApplication` class boots the full app locally with Testcontainers.

Package name note: the Java package uses underscores (`net.samitkumar.multi_tenant_salon`) because hyphens are invalid in Java package names.

## Java Instructions
- Always use java record types for data models where possible for immutability and simplicity.
- Use Lombok's `@Builder` for complex objects to simplify construction while maintaining immutability.

## Spring Boot & Spring Framework Instructions
- Follow the latest Spring Framework 7 best practices https://docs.spring.io/spring-framework/reference/index.html.
- Follow the latest Spring Boot 4 best practices https://docs.spring.io/spring-boot/index.html
- Follow the latest Spring MVC best practices https://docs.spring.io/spring-framework/reference/web/webmvc.html
- Follow the modular structure strictly to maintain clear boundaries between modules.
- Use Spring events for communication between modules to keep them decoupled.
- If there is a need to consume data from an external service, use Spring's Http Service Client Enhancement (introduced in Spring Boot 4). https://spring.io/blog/2025/09/23/http-service-client-enhancements.
- Ensure all Integration test use RestTestClient https://docs.spring.io/spring-framework/reference/testing/resttestclient.html
- Ensure all tests run successfully with Testcontainers to validate real PostgreSQL interactions.

## Instruction
- For each changes, make sure to run `./mvnw clean install` or Just compile and Test.
- If any api related changes , make sure to change [OAS](./oas/OAS.yaml) and [api.md](./oas/api.md).
