# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
# Build
./mvnw clean package

# Run tests (requires Docker for Testcontainers)
./mvnw test

# Run a single test class
./mvnw test -Dtest=MultiTenantSaloonApplicationTests

# Run the app in test mode (starts MongoDB via Testcontainers)
./mvnw spring-boot:test-run

# Run the app in production mode (requires a running MongoDB instance at localhost:27017 or with a real connection string configured in application.yaml)
./mvnw spring-boot:run

# Build native image (requires GraalVM 25+)
./mvnw native:compile -Pnative

# Build OCI container image
./mvnw spring-boot:build-image -Pnative
```

## Stack

- **Java 25**, **Spring Boot 4.0.6**, **Spring Modulith 2.0.6**
- **MongoDB** via Spring Data MongoDB
- **Lombok** for boilerplate reduction
- **Testcontainers** (`mongo:latest`) for integration tests — tests hit a real MongoDB container, not mocks
- GraalVM Native Image support configured via `native-maven-plugin`

## Architecture

This is a **modular monolith** using [Spring Modulith](https://docs.spring.io/spring-modulith/reference/). Modules are enforced as Java packages under `net.samitkumar.multi_tenant_saloon`. Each top-level sub-package is treated as an independent module with enforced boundaries.

The application is a **multi-tenant SaaS platform for saloon/salon management**. The architecture diagram is in `saloon_saas_architecture.svg`.

Key conventions from the Spring Modulith setup:
- Module internals go in sub-packages (e.g., `module.internal`) and are not accessible to other modules
- Cross-module communication should use Spring application events, not direct bean injection across module boundaries
- `spring-modulith-starter-mongodb` provides event publication with MongoDB-backed persistence

## Testing

The `TestcontainersConfiguration` class auto-wires a MongoDB container for any test that `@Import`s it. The `TestMultiTenantSaloonApplication` class can be used to boot the full app locally with Testcontainers providing dependencies.

Package name note: the Java package uses underscores (`net.samitkumar.multi_tenant_saloon`) because hyphens are invalid in Java package names.

## Java Instructions
- Always use java record types for data models where possible for immutability and simplicity.
- Use Lombok's `@Builder` for complex objects to simplify construction while maintaining immutability.

## Springboot & spring framework Instructions
- Follow the latest Spring framework 7 best practices https://docs.spring.io/spring-framework/reference/index.html.
- Follow the latest Spring boot 4 best practices https://docs.spring.io/spring-boot/index.html
- Follow the modular structure strictly to maintain clear boundaries between modules.
- Use Spring events for communication between modules to keep them decoupled.
- If there is a need to consume data from an external service, use Spring's Http Service Client Enhancement (introduced in Spring Boot 4). https://spring.io/blog/2025/09/23/http-service-client-enhancements.
- Ensure all tests run successfully with Testcontainers to validate real MongoDB interactions.
