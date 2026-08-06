package net.samitkumar.multi_tenant_saloon.booking;

import net.samitkumar.multi_tenant_saloon.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

@ApplicationModuleTest(mode = ApplicationModuleTest.BootstrapMode.ALL_DEPENDENCIES)
@Import(TestcontainersConfiguration.class)
class BookingModuleTests {

    @Autowired
    JdbcTemplate jdbcTemplate;

    RestTestClient client;
    UUID saloonId;
    String serviceId;
    String staffId;

    // Fixed Monday in the future for deterministic availability tests
    static final String TEST_DATE = "2027-01-04";
    // Sunday — outside the default Mon–Sat seeded schedule
    static final String TEST_DATE_SUNDAY = "2027-01-10";

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();

        saloonId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO saloon (id, name, handler, owner_name, owner_email, created_at) VALUES (?, ?, ?, ?, ?, now())",
                saloonId, "Booking Test Saloon", "book-test-" + saloonId.toString().substring(0, 8),
                "Test Owner", "test@booking.com");

        serviceId = client.post()
                .uri("/api/saloon-admin/{id}/services", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "60-min Haircut",
                            "price": 50.00,
                            "currency": "USD",
                            "durationMinutes": 60,
                            "category": "HAIR"
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .returnResult()
                .getResponseHeaders().getLocation().getPath()
                .replaceAll(".*/", "");

        staffId = client.post()
                .uri("/api/saloon-admin/{id}/staff", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Test Stylist",
                            "email": "stylist@test.com",
                            "role": "STYLIST"
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .returnResult()
                .getResponseHeaders().getLocation().getPath()
                .replaceAll(".*/", "");
    }

    // ── Availability ─────────────────────────────────────────────────────────

    @Test
    void setAndGetAvailability() {
        client.put()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability", saloonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [
                          {"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true},
                          {"dayOfWeek": "TUESDAY", "startTime": "09:00", "endTime": "17:00", "available": true},
                          {"dayOfWeek": "SATURDAY", "startTime": "10:00", "endTime": "14:00", "available": true}
                        ]
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(3)
                .jsonPath("$[0].dayOfWeek").isEqualTo("MONDAY");

        client.get()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability", saloonId, staffId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(3);
    }

    @Test
    void replaceAvailabilityIsIdempotent() {
        client.put()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability", saloonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        client.put()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability", saloonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "WEDNESDAY", "startTime": "08:00", "endTime": "16:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1)
                .jsonPath("$[0].dayOfWeek").isEqualTo("WEDNESDAY");

        client.get()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability", saloonId, staffId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1);
    }

    // ── Overrides ─────────────────────────────────────────────────────────────

    @Test
    void availabilityOverrideLifecycle() {
        var created = client.post()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability/overrides", saloonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "overrideDate": "2027-12-25",
                            "available": false,
                            "reason": "Christmas"
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.overrideDate").isEqualTo("2027-12-25")
                .jsonPath("$.available").isEqualTo(false)
                .jsonPath("$.reason").isEqualTo("Christmas")
                .returnResult();

        String overrideId = created.getResponseHeaders().getLocation().getPath().replaceAll(".*/", "");

        client.get()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability/overrides", saloonId, staffId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1);

        client.delete()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability/overrides/{overrideId}",
                        saloonId, staffId, overrideId)
                .exchange()
                .expectStatus().isNoContent();

        client.get()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability/overrides", saloonId, staffId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(0);
    }

    // ── Slots ─────────────────────────────────────────────────────────────────

    @Test
    void getAvailableSlotsWhenStaffHasAvailability() {
        // Set Monday availability (TEST_DATE = 2027-01-04 is a Monday)
        client.put()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability", saloonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "12:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        // 3-hour window / 60 min service = 3 slots
        client.get()
                .uri(u -> u.path("/api/saloon/{saloonId}/slots")
                        .queryParam("serviceId", serviceId)
                        .queryParam("date", TEST_DATE)
                        .queryParam("staffId", staffId)
                        .build(saloonId))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$").isArray()
                .jsonPath("$.length()").isEqualTo(3)
                .jsonPath("$[0].startTime").isEqualTo("09:00:00")
                .jsonPath("$[1].startTime").isEqualTo("10:00:00")
                .jsonPath("$[2].startTime").isEqualTo("11:00:00");
    }

    @Test
    void bookedSlotsAreReturnedAsBooked() {
        client.put()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability", saloonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "12:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        client.post()
                .uri("/api/saloon/{saloonId}/booking", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "serviceId": %s,
                            "staffId": %s,
                            "customerName": "Alice",
                            "customerEmail": "alice@test.com",
                            "appointmentDate": "%s",
                            "startTime": "09:00"
                        }
                        """.formatted(serviceId, staffId, TEST_DATE))
                .exchange()
                .expectStatus().isCreated();

        client.get()
                .uri(u -> u.path("/api/saloon/{saloonId}/slots")
                        .queryParam("serviceId", serviceId)
                        .queryParam("date", TEST_DATE)
                        .queryParam("staffId", staffId)
                        .build(saloonId))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(3)
                .jsonPath("$[0].startTime").isEqualTo("09:00:00")
                .jsonPath("$[0].booked").isEqualTo(true)
                .jsonPath("$[1].startTime").isEqualTo("10:00:00")
                .jsonPath("$[1].booked").isEqualTo(false)
                .jsonPath("$[2].startTime").isEqualTo("11:00:00")
                .jsonPath("$[2].booked").isEqualTo(false);
    }

    @Test
    void getAvailableSlotsReturnsEmptyWhenNoAvailability() {
        // Sunday is outside the default Mon–Sat seeded schedule, so 0 slots regardless
        client.get()
                .uri(u -> u.path("/api/saloon/{saloonId}/slots")
                        .queryParam("serviceId", serviceId)
                        .queryParam("date", TEST_DATE_SUNDAY)
                        .queryParam("staffId", staffId)
                        .build(saloonId))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$").isArray()
                .jsonPath("$.length()").isEqualTo(0);
    }

    @Test
    void getAvailableSlotsServiceNotFound() {
        client.get()
                .uri(u -> u.path("/api/saloon/{saloonId}/slots")
                        .queryParam("serviceId", "99999")
                        .queryParam("date", TEST_DATE)
                        .build(saloonId))
                .exchange()
                .expectStatus().isNotFound();
    }

    // ── Bookings ──────────────────────────────────────────────────────────────

    @Test
    void bookingLifecycle() {
        // Set Monday availability
        client.put()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability", saloonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        var created = client.post()
                .uri("/api/saloon/{saloonId}/booking", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "serviceId": %s,
                            "staffId": %s,
                            "customerName": "John Doe",
                            "customerEmail": "john@doe.com",
                            "customerPhone": "+1234567890",
                            "appointmentDate": "%s",
                            "startTime": "10:00",
                            "notes": "First visit"
                        }
                        """.formatted(serviceId, staffId, TEST_DATE))
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.id").isNotEmpty()
                .jsonPath("$.customerName").isEqualTo("John Doe")
                .jsonPath("$.status").isEqualTo("CONFIRMED")
                .jsonPath("$.startTime").isEqualTo("10:00:00")
                .jsonPath("$.endTime").isEqualTo("11:00:00")
                .returnResult();

        String bookingId = created.getResponseHeaders().getLocation().getPath().replaceAll(".*/", "");

        client.get()
                .uri("/api/saloon-admin/{saloonId}/booking/{bookingId}", saloonId, bookingId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("CONFIRMED");

        client.get()
                .uri("/api/saloon-admin/{saloonId}/booking", saloonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1);

        client.post()
                .uri("/api/saloon-admin/{saloonId}/booking/{bookingId}/confirm", saloonId, bookingId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("CONFIRMED");

        client.post()
                .uri("/api/saloon-admin/{saloonId}/booking/{bookingId}/complete", saloonId, bookingId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("COMPLETED");
    }

    @Test
    void bookingCanBeCancelled() {
        client.put()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability", saloonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        var created = client.post()
                .uri("/api/saloon/{saloonId}/booking", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "serviceId": %s,
                            "staffId": %s,
                            "customerName": "Jane Cancel",
                            "customerEmail": "jane@cancel.com",
                            "appointmentDate": "%s",
                            "startTime": "13:00"
                        }
                        """.formatted(serviceId, staffId, TEST_DATE))
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Void.class)
                .returnResult();

        String bookingId = created.getResponseHeaders().getLocation().getPath().replaceAll(".*/", "");

        client.post()
                .uri("/api/saloon-admin/{saloonId}/booking/{bookingId}/cancel", saloonId, bookingId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("CANCELLED");
    }

    @Test
    void bookingCanBeMarkedNoShow() {
        client.put()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability", saloonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        var created = client.post()
                .uri("/api/saloon/{saloonId}/booking", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "serviceId": %s,
                            "staffId": %s,
                            "customerName": "No Show Sam",
                            "customerEmail": "noshow@test.com",
                            "appointmentDate": "%s",
                            "startTime": "15:00"
                        }
                        """.formatted(serviceId, staffId, TEST_DATE))
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Void.class)
                .returnResult();

        String bookingId = created.getResponseHeaders().getLocation().getPath().replaceAll(".*/", "");

        client.post()
                .uri("/api/saloon-admin/{saloonId}/booking/{bookingId}/no-show", saloonId, bookingId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("NO_SHOW");
    }

    @Test
    void bookingConflictIsRejected() {
        client.put()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability", saloonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        // First booking at 09:00
        client.post()
                .uri("/api/saloon/{saloonId}/booking", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "serviceId": %s,
                            "staffId": %s,
                            "customerName": "First",
                            "customerEmail": "first@test.com",
                            "appointmentDate": "%s",
                            "startTime": "09:00"
                        }
                        """.formatted(serviceId, staffId, TEST_DATE))
                .exchange()
                .expectStatus().isCreated();

        // Second booking at the same slot should fail
        client.post()
                .uri("/api/saloon/{saloonId}/booking", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "serviceId": %s,
                            "staffId": %s,
                            "customerName": "Conflict",
                            "customerEmail": "conflict@test.com",
                            "appointmentDate": "%s",
                            "startTime": "09:00"
                        }
                        """.formatted(serviceId, staffId, TEST_DATE))
                .exchange()
                .expectStatus().isEqualTo(409);
    }

    @Test
    void bookingNotFound() {
        client.get()
                .uri("/api/saloon-admin/{saloonId}/booking/99999", saloonId)
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void deleteBooking() {
        client.put()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability", saloonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        var created = client.post()
                .uri("/api/saloon/{saloonId}/booking", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "serviceId": %s,
                            "staffId": %s,
                            "customerName": "Delete Me",
                            "customerEmail": "delete@test.com",
                            "appointmentDate": "%s",
                            "startTime": "16:00"
                        }
                        """.formatted(serviceId, staffId, TEST_DATE))
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Void.class)
                .returnResult();

        String bookingId = created.getResponseHeaders().getLocation().getPath().replaceAll(".*/", "");

        client.delete()
                .uri("/api/saloon-admin/{saloonId}/booking/{bookingId}", saloonId, bookingId)
                .exchange()
                .expectStatus().isNoContent();

        client.get()
                .uri("/api/saloon-admin/{saloonId}/booking/{bookingId}", saloonId, bookingId)
                .exchange()
                .expectStatus().isNotFound();
    }
}
