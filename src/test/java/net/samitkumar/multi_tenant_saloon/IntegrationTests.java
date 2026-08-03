package net.samitkumar.multi_tenant_saloon;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.context.WebApplicationContext;

/**
 * End-to-end integration test covering all API endpoints in a realistic scenario:
 * create saloon → add services/staff → configure availability → book → manage lifecycle.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class IntegrationTests {

    RestTestClient client;

    // Shared state across ordered test methods
    static String saloonId;
    static String serviceId;
    static String staffId;
    static String bookingId;
    static String overrideId;

    static final String BOOKING_DATE = "2027-02-01"; // Monday

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
    }

    // ── Saloon ────────────────────────────────────────────────────────────────

    @Test
    @Order(1)
    void createSaloon() {
        var result = client.post()
                .uri("/api/saloon-onboarding")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Integration Saloon",
                            "ownerName": "Integration Owner",
                            "ownerEmail": "owner@integration.com",
                            "ownerPhone": "+1234567890",
                            "location": {
                                "address": "123 Main St",
                                "city": "Testville",
                                "state": "TS",
                                "country": "US",
                                "zipCode": "12345"
                            },
                            "contact": {
                                "phone": "+9876543210",
                                "email": "contact@integration.com",
                                "website": "https://integration-saloon.com"
                            },
                            "features": ["BOOKING", "STATIC_WEBSITE"]
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.saloonId").isNotEmpty()
                .jsonPath("$.saloonHandler").isEqualTo("integration-saloon")
                .jsonPath("$.emailId").isEqualTo("owner@integration.com")
                .jsonPath("$.message").isNotEmpty()
                .returnResult();

        saloonId = result.getResponseHeaders().getLocation().getPath().replaceAll(".*/", "");
    }

    @Test
    @Order(2)
    void getMySaloonsByEmail() {
        client.get()
                .uri("/api/saloon-admin/my-saloons?email=owner@integration.com")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$").isArray()
                .jsonPath("$[0].id").isEqualTo(saloonId)
                .jsonPath("$[0].owner.email").isEqualTo("owner@integration.com");

        client.get()
                .uri("/api/saloon-admin/my-saloons?email=nobody@unknown.com")
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    @Order(3)
    void listSaloons() {
        client.get()
                .uri("/api/saloon-onboarding")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$").isArray();
    }

    @Test
    @Order(3)
    void getSaloonById() {
        client.get()
                .uri("/api/saloon/{id}", saloonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.id").isEqualTo(saloonId)
                .jsonPath("$.name").isEqualTo("Integration Saloon")
                .jsonPath("$.location.city").isEqualTo("Testville")
                .jsonPath("$.contact.email").isEqualTo("contact@integration.com")
                .jsonPath("$.features.length()").isEqualTo(2);
    }

    @Test
    @Order(4)
    void getSaloonByHandler() {
        client.get()
                .uri("/api/saloon/integration-saloon")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.id").isEqualTo(saloonId);
    }

    @Test
    @Order(5)
    void updateSaloon() {
        client.put()
                .uri("/api/saloon-admin/{id}", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Integration Saloon Pro",
                            "location": {
                                "address": "456 Oak Ave",
                                "city": "Newtown",
                                "state": "NT",
                                "country": "US",
                                "zipCode": "67890"
                            }
                        }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.name").isEqualTo("Integration Saloon Pro")
                .jsonPath("$.location.city").isEqualTo("Newtown");
    }

    @Test
    @Order(6)
    void updateSaloonFeatures() {
        client.put()
                .uri("/api/saloon-admin/{id}/features", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        ["BOOKING", "STATIC_WEBSITE", "ANALYTICS"]
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.features.length()").isEqualTo(3);
    }

    @Test
    @Order(8)
    void saloonNotFound() {
        client.get()
                .uri("/api/saloon/00000000-0000-0000-0000-000000000000")
                .exchange()
                .expectStatus().isNotFound();
    }

    // ── Services ──────────────────────────────────────────────────────────────

    @Test
    @Order(10)
    void addService() {
        var result = client.post()
                .uri("/api/saloon-admin/{id}/services", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Premium Haircut",
                            "description": "Full styling service",
                            "price": 60.00,
                            "currency": "USD",
                            "durationMinutes": 60,
                            "category": "HAIR"
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.name").isEqualTo("Premium Haircut")
                .jsonPath("$.durationMinutes").isEqualTo(60)
                .jsonPath("$.active").isEqualTo(true)
                .returnResult();

        serviceId = result.getResponseHeaders().getLocation().getPath().replaceAll(".*/", "");
    }

    @Test
    @Order(11)
    void listServices() {
        client.get()
                .uri("/api/saloon-admin/{id}/services", saloonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(2);
    }

    @Test
    @Order(12)
    void getService() {
        client.get()
                .uri("/api/saloon-admin/{saloonId}/services/{serviceId}", saloonId, serviceId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.id").isEqualTo(Integer.parseInt(serviceId))
                .jsonPath("$.category").isEqualTo("HAIR");
    }

    @Test
    @Order(13)
    void updateService() {
        client.put()
                .uri("/api/saloon-admin/{saloonId}/services/{serviceId}", saloonId, serviceId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Premium Haircut & Style",
                            "description": "Full styling + wash",
                            "price": 75.00,
                            "currency": "USD",
                            "durationMinutes": 60,
                            "category": "HAIR",
                            "active": true
                        }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.name").isEqualTo("Premium Haircut & Style")
                .jsonPath("$.price").isEqualTo(75.0);
    }

    @Test
    @Order(14)
    void serviceNotFound() {
        client.get()
                .uri("/api/saloon-admin/{saloonId}/services/99999", saloonId)
                .exchange()
                .expectStatus().isNotFound();
    }

    // ── Staff ─────────────────────────────────────────────────────────────────

    @Test
    @Order(20)
    void onboardStaff() {
        var result = client.post()
                .uri("/api/saloon-admin/{id}/staff", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Sam Stylist",
                            "email": "sam@integration.com",
                            "phone": "+1111111111",
                            "role": "STYLIST",
                            "specializations": ["haircut", "coloring", "balayage"]
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.name").isEqualTo("Sam Stylist")
                .jsonPath("$.role").isEqualTo("STYLIST")
                .jsonPath("$.status").isEqualTo("ACTIVE")
                .jsonPath("$.specializations.length()").isEqualTo(3)
                .returnResult();

        staffId = result.getResponseHeaders().getLocation().getPath().replaceAll(".*/", "");
    }

    @Test
    @Order(21)
    void listStaff() {
        client.get()
                .uri("/api/saloon-admin/{id}/staff", saloonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(2);
    }

    @Test
    @Order(22)
    void getStaff() {
        client.get()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}", saloonId, staffId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.id").isEqualTo(Integer.parseInt(staffId))
                .jsonPath("$.email").isEqualTo("sam@integration.com");
    }

    @Test
    @Order(23)
    void updateStaff() {
        client.put()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}", saloonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Sam Stylist",
                            "email": "sam@integration.com",
                            "phone": "+1111111111",
                            "role": "COLORIST",
                            "status": "ACTIVE",
                            "specializations": ["haircut", "coloring", "highlights"]
                        }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.role").isEqualTo("COLORIST");
    }

    @Test
    @Order(24)
    void staffNotFound() {
        client.get()
                .uri("/api/saloon-admin/{saloonId}/staff/99999", saloonId)
                .exchange()
                .expectStatus().isNotFound();
    }

    // ── Website Theme ─────────────────────────────────────────────────────────

    @Test
    @Order(30)
    void getDefaultTheme() {
        client.get()
                .uri("/api/saloon/{id}/website", saloonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.saloonId").isEqualTo(saloonId)
                .jsonPath("$.heroBg").isEqualTo("#0F172A")
                .jsonPath("$.accentColor").isEqualTo("#F59E0B");
    }

    @Test
    @Order(31)
    void saveTheme() {
        client.put()
                .uri("/api/saloon-admin/{id}/website", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "heroBg": "#2D3436",
                            "heroTextColor": "#DFE6E9",
                            "accentColor": "#6C5CE7",
                            "fontFamily": "poppins",
                            "logoBgColor": "#A29BFE"
                        }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.heroBg").isEqualTo("#2D3436")
                .jsonPath("$.accentColor").isEqualTo("#6C5CE7")
                .jsonPath("$.fontFamily").isEqualTo("poppins")
                .jsonPath("$.updatedAt").isNotEmpty();
    }

    @Test
    @Order(32)
    void getUpdatedTheme() {
        client.get()
                .uri("/api/saloon/{id}/website", saloonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.heroBg").isEqualTo("#2D3436")
                .jsonPath("$.fontFamily").isEqualTo("poppins");
    }

    // ── Availability ──────────────────────────────────────────────────────────

    @Test
    @Order(40)
    void setWeeklyAvailability() {
        client.put()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability", saloonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [
                          {"dayOfWeek": "MONDAY",    "startTime": "09:00", "endTime": "17:00", "available": true},
                          {"dayOfWeek": "TUESDAY",   "startTime": "09:00", "endTime": "17:00", "available": true},
                          {"dayOfWeek": "WEDNESDAY", "startTime": "09:00", "endTime": "17:00", "available": true},
                          {"dayOfWeek": "THURSDAY",  "startTime": "09:00", "endTime": "17:00", "available": true},
                          {"dayOfWeek": "FRIDAY",    "startTime": "09:00", "endTime": "17:00", "available": true},
                          {"dayOfWeek": "SATURDAY",  "startTime": "10:00", "endTime": "14:00", "available": true},
                          {"dayOfWeek": "SUNDAY",    "startTime": "00:00", "endTime": "00:00", "available": false}
                        ]
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(7);
    }

    @Test
    @Order(41)
    void getWeeklyAvailability() {
        client.get()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability", saloonId, staffId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(7);
    }

    @Test
    @Order(42)
    void addAvailabilityOverride() {
        var result = client.post()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability/overrides", saloonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "overrideDate": "2027-12-25",
                            "available": false,
                            "reason": "Christmas holiday"
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.overrideDate").isEqualTo("2027-12-25")
                .jsonPath("$.available").isEqualTo(false)
                .returnResult();

        overrideId = result.getResponseHeaders().getLocation().getPath().replaceAll(".*/", "");
    }

    @Test
    @Order(43)
    void listAvailabilityOverrides() {
        client.get()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability/overrides", saloonId, staffId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1)
                .jsonPath("$[0].reason").isEqualTo("Christmas holiday");
    }

    @Test
    @Order(44)
    void deleteAvailabilityOverride() {
        client.delete()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability/overrides/{overrideId}",
                        saloonId, staffId, overrideId)
                .exchange()
                .expectStatus().isNoContent();

        client.get()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}/availability/overrides", saloonId, staffId)
                .exchange()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(0);
    }

    // ── Slots ─────────────────────────────────────────────────────────────────

    @Test
    @Order(50)
    void getAvailableSlots() {
        // BOOKING_DATE = 2027-02-01 (Monday), staff has 09:00-17:00, service is 60 min → 8 slots
        client.get()
                .uri(u -> u.path("/api/saloon/{saloonId}/slots")
                        .queryParam("serviceId", serviceId)
                        .queryParam("date", BOOKING_DATE)
                        .queryParam("staffId", staffId)
                        .build(saloonId))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(8)
                .jsonPath("$[0].startTime").isEqualTo("09:00:00")
                .jsonPath("$[0].endTime").isEqualTo("10:00:00")
                .jsonPath("$[0].staffId").isEqualTo(Integer.parseInt(staffId));
    }

    @Test
    @Order(51)
    void getAvailableSlotsWithoutStaffFilter() {
        client.get()
                .uri(u -> u.path("/api/saloon/{saloonId}/slots")
                        .queryParam("serviceId", serviceId)
                        .queryParam("date", BOOKING_DATE)
                        .build(saloonId))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$").isArray();
    }

    // ── Bookings ──────────────────────────────────────────────────────────────

    @Test
    @Order(60)
    void createBooking() {
        var result = client.post()
                .uri("/api/saloon/{saloonId}/booking", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "serviceId": %s,
                            "staffId": %s,
                            "customerName": "Alice Customer",
                            "customerEmail": "alice@customer.com",
                            "customerPhone": "+9999999999",
                            "appointmentDate": "%s",
                            "startTime": "10:00",
                            "notes": "First visit, prefers cold water"
                        }
                        """.formatted(serviceId, staffId, BOOKING_DATE))
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.status").isEqualTo("PENDING")
                .jsonPath("$.customerName").isEqualTo("Alice Customer")
                .jsonPath("$.startTime").isEqualTo("10:00:00")
                .jsonPath("$.endTime").isEqualTo("11:00:00")
                .returnResult();

        bookingId = result.getResponseHeaders().getLocation().getPath().replaceAll(".*/", "");
    }

    @Test
    @Order(61)
    void getBooking() {
        client.get()
                .uri("/api/saloon-admin/{saloonId}/booking/{bookingId}", saloonId, bookingId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.id").isEqualTo(Integer.parseInt(bookingId))
                .jsonPath("$.customerEmail").isEqualTo("alice@customer.com")
                .jsonPath("$.notes").isEqualTo("First visit, prefers cold water");
    }

    @Test
    @Order(62)
    void listBookings() {
        client.get()
                .uri("/api/saloon-admin/{saloonId}/booking", saloonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$").isArray()
                .jsonPath("$.length()").isEqualTo(1);
    }

    @Test
    @Order(63)
    void conflictingSlotRejected() {
        client.post()
                .uri("/api/saloon/{saloonId}/booking", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "serviceId": %s,
                            "staffId": %s,
                            "customerName": "Conflict Bob",
                            "customerEmail": "conflict@test.com",
                            "appointmentDate": "%s",
                            "startTime": "10:00"
                        }
                        """.formatted(serviceId, staffId, BOOKING_DATE))
                .exchange()
                .expectStatus().isEqualTo(409);
    }

    @Test
    @Order(64)
    void confirmBooking() {
        client.post()
                .uri("/api/saloon-admin/{saloonId}/booking/{bookingId}/confirm", saloonId, bookingId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("CONFIRMED");
    }

    @Test
    @Order(65)
    void rescheduleBooking() {
        client.put()
                .uri("/api/saloon-admin/{saloonId}/booking/{bookingId}", saloonId, bookingId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "appointmentDate": "%s",
                            "startTime": "14:00",
                            "notes": "Rescheduled by customer"
                        }
                        """.formatted(BOOKING_DATE))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.startTime").isEqualTo("14:00:00")
                .jsonPath("$.endTime").isEqualTo("15:00:00")
                .jsonPath("$.notes").isEqualTo("Rescheduled by customer");
    }

    @Test
    @Order(66)
    void completeBooking() {
        client.post()
                .uri("/api/saloon-admin/{saloonId}/booking/{bookingId}/complete", saloonId, bookingId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("COMPLETED");
    }

    @Test
    @Order(67)
    void createAndCancelBooking() {
        var result = client.post()
                .uri("/api/saloon/{saloonId}/booking", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "serviceId": %s,
                            "staffId": %s,
                            "customerName": "Cancel Me",
                            "customerEmail": "cancel@test.com",
                            "appointmentDate": "%s",
                            "startTime": "11:00"
                        }
                        """.formatted(serviceId, staffId, BOOKING_DATE))
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Void.class)
                .returnResult();

        String cancelId = result.getResponseHeaders().getLocation().getPath().replaceAll(".*/", "");

        client.post()
                .uri("/api/saloon-admin/{saloonId}/booking/{bookingId}/cancel", saloonId, cancelId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("CANCELLED");
    }

    @Test
    @Order(68)
    void createAndMarkNoShow() {
        var result = client.post()
                .uri("/api/saloon/{saloonId}/booking", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "serviceId": %s,
                            "staffId": %s,
                            "customerName": "No Show Nancy",
                            "customerEmail": "noshow@test.com",
                            "appointmentDate": "%s",
                            "startTime": "12:00"
                        }
                        """.formatted(serviceId, staffId, BOOKING_DATE))
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Void.class)
                .returnResult();

        String noShowId = result.getResponseHeaders().getLocation().getPath().replaceAll(".*/", "");

        client.post()
                .uri("/api/saloon-admin/{saloonId}/booking/{bookingId}/no-show", saloonId, noShowId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("NO_SHOW");
    }

    @Test
    @Order(69)
    void deleteBooking() {
        var result = client.post()
                .uri("/api/saloon/{saloonId}/booking", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "serviceId": %s,
                            "staffId": %s,
                            "customerName": "Delete Me",
                            "customerEmail": "del@test.com",
                            "appointmentDate": "%s",
                            "startTime": "09:00"
                        }
                        """.formatted(serviceId, staffId, BOOKING_DATE))
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Void.class)
                .returnResult();

        String delId = result.getResponseHeaders().getLocation().getPath().replaceAll(".*/", "");

        client.delete()
                .uri("/api/saloon-admin/{saloonId}/booking/{bookingId}", saloonId, delId)
                .exchange()
                .expectStatus().isNoContent();

        client.get()
                .uri("/api/saloon-admin/{saloonId}/booking/{bookingId}", saloonId, delId)
                .exchange()
                .expectStatus().isNotFound();
    }

    // ── Utility ───────────────────────────────────────────────────────────────

    @Test
    @Order(80)
    void listCountries() {
        client.get()
                .uri("/api/saloon-utility/countries")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$").isArray()
                .jsonPath("$[0].name").isNotEmpty()
                .jsonPath("$[0].code").isNotEmpty()
                .jsonPath("$[0].dialCode").isNotEmpty();
    }

    @Test
    @Order(81)
    void listCurrencies() {
        client.get()
                .uri("/api/saloon-utility/currencies")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$").isArray()
                .jsonPath("$[0].code").isNotEmpty()
                .jsonPath("$[0].name").isNotEmpty()
                .jsonPath("$[0].symbol").isNotEmpty();
    }

    // ── Teardown scenario ─────────────────────────────────────────────────────

    @Test
    @Order(90)
    void deleteStaff() {
        client.delete()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}", saloonId, staffId)
                .exchange()
                .expectStatus().isNoContent();

        client.get()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}", saloonId, staffId)
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    @Order(91)
    void deleteService() {
        client.delete()
                .uri("/api/saloon-admin/{saloonId}/services/{serviceId}", saloonId, serviceId)
                .exchange()
                .expectStatus().isNoContent();

        client.get()
                .uri("/api/saloon-admin/{saloonId}/services/{serviceId}", saloonId, serviceId)
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    @Order(92)
    void deleteSaloon() {
        client.delete()
                .uri("/api/saloon-admin/{id}", saloonId)
                .exchange()
                .expectStatus().isNoContent();

        client.get()
                .uri("/api/saloon/{id}", saloonId)
                .exchange()
                .expectStatus().isNotFound();
    }
}
