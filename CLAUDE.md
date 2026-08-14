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
./mvnw spring-boot:run

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
- Cross-module communication uses Spring application events, not direct bean injection across module boundaries
- `spring-modulith-starter-jdbc` provides event publication with PostgreSQL-backed persistence

## Modules

- **`salon`** — Core aggregate: `Salon` entity with embedded `Owner`/`Location`/`ContactInfo` and child tables for `operatingHours`/`features`. Publishes `SalonCreatedEvent`.
- **`salonservice`** — `ServiceItem` catalog per salon (pricing, duration, category, assigned staff).
- **`staff`** — `StaffMember` roster per salon (role, status, specializations).
- **`notification`** — Listens to `SalonCreatedEvent` via `@ApplicationModuleListener` (decoupled, async-safe).

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
- If any api related changes , make sure to change [OAS](./oas/OAS.yaml) and [api.md](./wiki/api.md).
