package net.samitkumar.multi_tenant_salon.booking;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
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
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

@ApplicationModuleTest(mode = ApplicationModuleTest.BootstrapMode.ALL_DEPENDENCIES)
@Import(TestcontainersConfiguration.class)
class BookingModuleTests {

    @Autowired
    JdbcTemplate jdbcTemplate;

    RestTestClient client;
    UUID salonId;
    String serviceId;
    String staffId;

    // Fixed Monday in the future for deterministic availability tests
    static final String TEST_DATE = "2027-01-04";
    // Sunday — outside the default Mon–Sat seeded schedule
    static final String TEST_DATE_SUNDAY = "2027-01-10";

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();

        salonId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO salon (id, name, handler, owner_name, owner_email, created_at) VALUES (?, ?, ?, ?, ?, now())",
                salonId, "Booking Test Salon", "book-test-" + salonId.toString().substring(0, 8),
                "Test Owner", "test@booking.com");

        serviceId = client.post()
                .uri("/api/salon-admin/{id}/services", salonId)
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
                .uri("/api/salon-admin/{id}/staff", salonId)
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
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability", salonId, staffId)
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
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability", salonId, staffId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(3);
    }

    @Test
    void replaceAvailabilityIsIdempotent() {
        client.put()
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability", salonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        client.put()
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability", salonId, staffId)
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
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability", salonId, staffId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1);
    }

    // ── Overrides ─────────────────────────────────────────────────────────────

    @Test
    void availabilityOverrideLifecycle() {
        var created = client.post()
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability/overrides", salonId, staffId)
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
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability/overrides", salonId, staffId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1);

        client.delete()
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability/overrides/{overrideId}",
                        salonId, staffId, overrideId)
                .exchange()
                .expectStatus().isNoContent();

        client.get()
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability/overrides", salonId, staffId)
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
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability", salonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "12:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        // 3-hour window / 60 min service = 3 slots
        client.get()
                .uri(u -> u.path("/api/salon/{salonId}/booking/slots")
                        .queryParam("serviceId", serviceId)
                        .queryParam("date", TEST_DATE)
                        .queryParam("staffId", staffId)
                        .build(salonId))
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
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability", salonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "12:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        client.post()
                .uri("/api/salon/{salonId}/booking", salonId)
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
                .uri(u -> u.path("/api/salon/{salonId}/booking/slots")
                        .queryParam("serviceId", serviceId)
                        .queryParam("date", TEST_DATE)
                        .queryParam("staffId", staffId)
                        .build(salonId))
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
                .uri(u -> u.path("/api/salon/{salonId}/booking/slots")
                        .queryParam("serviceId", serviceId)
                        .queryParam("date", TEST_DATE_SUNDAY)
                        .queryParam("staffId", staffId)
                        .build(salonId))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$").isArray()
                .jsonPath("$.length()").isEqualTo(0);
    }

    @Test
    void getAvailableSlotsServiceNotFound() {
        client.get()
                .uri(u -> u.path("/api/salon/{salonId}/booking/slots")
                        .queryParam("serviceId", "99999")
                        .queryParam("date", TEST_DATE)
                        .build(salonId))
                .exchange()
                .expectStatus().isNotFound();
    }

    // ── Flexible availability query ───────────────────────────────────────────

    private void setMondayTuesdayAvailability() {
        client.put()
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability", salonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY",  "startTime": "09:00", "endTime": "17:00", "available": true},
                         {"dayOfWeek": "TUESDAY", "startTime": "09:00", "endTime": "17:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();
    }

    @Test
    void availabilityDayView_marksOpenWorkingDaysAndStaffOffDays() {
        setMondayTuesdayAvailability();

        client.get()
                .uri(u -> u.path("/api/salon/{salonId}/availability")
                        .queryParam("serviceId", serviceId)
                        .queryParam("from", TEST_DATE)          // 2027-01-04, a Monday
                        .queryParam("to", "2027-01-07")          // Thursday
                        .build(salonId))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.durationMinutes").isEqualTo(60)
                .jsonPath("$.days.length()").isEqualTo(4)
                .jsonPath("$.days[0].date").isEqualTo("2027-01-04")
                .jsonPath("$.days[0].weekday").isEqualTo("MONDAY")
                .jsonPath("$.days[0].status").isEqualTo("OPEN")
                .jsonPath("$.days[0].openSlotCount").isEqualTo(8)
                .jsonPath("$.days[0].firstOpenTime").isEqualTo("09:00:00")
                .jsonPath("$.days[1].status").isEqualTo("OPEN")            // Tuesday
                .jsonPath("$.days[2].status").isEqualTo("STAFF_OFF")       // Wednesday
                .jsonPath("$.days[2].reason").value(String.class, r -> org.assertj.core.api.Assertions.assertThat(r).contains("Wednesday"))
                .jsonPath("$.firstAvailable.date").isEqualTo("2027-01-04")
                .jsonPath("$.firstAvailable.startTime").isEqualTo("09:00:00");
    }

    @Test
    void availabilitySlotView_withLimit_returnsOnlyOpenDaysWithSlots() {
        setMondayTuesdayAvailability();

        client.get()
                .uri(u -> u.path("/api/salon/{salonId}/availability")
                        .queryParam("serviceId", serviceId)
                        .queryParam("from", TEST_DATE)
                        .queryParam("granularity", "SLOT")
                        .queryParam("limit", "1")
                        .build(salonId))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.days.length()").isEqualTo(1)
                .jsonPath("$.days[0].date").isEqualTo("2027-01-04")
                .jsonPath("$.days[0].status").isEqualTo("OPEN")
                .jsonPath("$.days[0].slots.length()").isEqualTo(8)
                .jsonPath("$.days[0].slots[0].startTime").isEqualTo("09:00:00")
                .jsonPath("$.days[0].slots[0].booked").isEqualTo(false);
    }

    @Test
    void availabilityDayView_scopedToStaffId_isStaffOffWhenThatStylistDoesNotWork() {
        setMondayTuesdayAvailability();

        client.get()
                .uri(u -> u.path("/api/salon/{salonId}/availability")
                        .queryParam("serviceId", serviceId)
                        .queryParam("staffId", staffId)
                        .queryParam("from", "2027-01-06")   // Wednesday — no availability row
                        .queryParam("to", "2027-01-06")
                        .build(salonId))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.staffId").isEqualTo(Integer.parseInt(staffId))
                .jsonPath("$.days[0].status").isEqualTo("STAFF_OFF")
                .jsonPath("$.days[0].reason").value(String.class, r -> org.assertj.core.api.Assertions.assertThat(r).contains("stylist"));
    }

    @Test
    void availabilityDayView_marksASalonHolidayClosedWithItsName() {
        setMondayTuesdayAvailability();

        client.post()
                .uri("/api/salon-admin/{salonId}/holidays", salonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"name": "Founders Day", "month": 1, "day": 5, "endMonth": null, "endDay": null, "year": 2027}
                        """)
                .exchange()
                .expectStatus().isOk();

        client.get()
                .uri(u -> u.path("/api/salon/{salonId}/availability")
                        .queryParam("serviceId", serviceId)
                        .queryParam("from", TEST_DATE)       // Mon 2027-01-04
                        .queryParam("to", "2027-01-05")       // Tue 2027-01-05 — the holiday
                        .build(salonId))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.days[0].status").isEqualTo("OPEN")
                .jsonPath("$.days[1].date").isEqualTo("2027-01-05")
                .jsonPath("$.days[1].status").isEqualTo("SALON_CLOSED")
                .jsonPath("$.days[1].reason").value(String.class, r -> org.assertj.core.api.Assertions.assertThat(r).contains("Founders Day"))
                .jsonPath("$.firstAvailable.date").isEqualTo("2027-01-04");
    }

    // ── Bookings ──────────────────────────────────────────────────────────────

    @Test
    void bookingLifecycle() {
        // Set Monday availability
        client.put()
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability", salonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        var created = client.post()
                .uri("/api/salon/{salonId}/booking", salonId)
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
                .uri("/api/salon-admin/{salonId}/booking/{bookingId}", salonId, bookingId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("CONFIRMED");

        client.get()
                .uri("/api/salon-admin/{salonId}/booking", salonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1);

        client.post()
                .uri("/api/salon-admin/{salonId}/booking/{bookingId}/confirm", salonId, bookingId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("CONFIRMED");

        client.post()
                .uri("/api/salon-admin/{salonId}/booking/{bookingId}/complete", salonId, bookingId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("COMPLETED");
    }

    @Test
    void bookingCanBeCancelled() {
        client.put()
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability", salonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        var created = client.post()
                .uri("/api/salon/{salonId}/booking", salonId)
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
                .uri("/api/salon-admin/{salonId}/booking/{bookingId}/cancel", salonId, bookingId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("CANCELLED");
    }

    @Test
    void bookingCanBeMarkedNoShow() {
        client.put()
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability", salonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        var created = client.post()
                .uri("/api/salon/{salonId}/booking", salonId)
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
                .uri("/api/salon-admin/{salonId}/booking/{bookingId}/no-show", salonId, bookingId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("NO_SHOW");
    }

    @Test
    void bookingConflictIsRejected() {
        client.put()
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability", salonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        // First booking at 09:00
        client.post()
                .uri("/api/salon/{salonId}/booking", salonId)
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
                .uri("/api/salon/{salonId}/booking", salonId)
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
    void concurrentBookingsForSameSlotLeaveExactlyOneWinner() throws Exception {
        client.put()
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability", salonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        int racers = 8;
        var pool = Executors.newFixedThreadPool(racers);
        var ready = new CountDownLatch(racers);
        var go = new CountDownLatch(1);
        var created = new AtomicInteger();
        var conflict = new AtomicInteger();
        var other = new AtomicInteger();

        var tasks = new java.util.ArrayList<Callable<Void>>();
        for (int i = 0; i < racers; i++) {
            final int n = i;
            tasks.add(() -> {
                ready.countDown();
                go.await();
                int status = client.post()
                        .uri("/api/salon/{salonId}/booking", salonId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("""
                                {
                                    "serviceId": %s,
                                    "staffId": %s,
                                    "customerName": "Racer %d",
                                    "customerEmail": "racer%d@test.com",
                                    "appointmentDate": "%s",
                                    "startTime": "13:00"
                                }
                                """.formatted(serviceId, staffId, n, n, TEST_DATE))
                        .exchange()
                        .expectBody().returnResult()
                        .getStatus().value();
                if (status == 201) created.incrementAndGet();
                else if (status == 409) conflict.incrementAndGet();
                else other.incrementAndGet();
                return null;
            });
        }

        var futures = new java.util.ArrayList<Future<Void>>();
        for (var t : tasks) futures.add(pool.submit(t));
        ready.await(10, TimeUnit.SECONDS);
        go.countDown();
        for (var f : futures) f.get(30, TimeUnit.SECONDS);
        pool.shutdown();

        // The DB is the source of truth: no double-booking regardless of HTTP timing.
        Integer active = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM booking WHERE salon_id = ? AND staff_id = ? AND appointment_date = ? "
                        + "AND start_time = TIME '13:00' AND status <> 'CANCELLED'",
                Integer.class, salonId, Long.parseLong(staffId), java.sql.Date.valueOf(TEST_DATE));
        assertThat(active).isEqualTo(1);
        assertThat(other).hasValue(0);
        assertThat(created).hasValue(1);
        assertThat(conflict).hasValue(racers - 1);
    }

    @Test
    void bookingNotFound() {
        client.get()
                .uri("/api/salon-admin/{salonId}/booking/99999", salonId)
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void deleteBooking() {
        client.put()
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability", salonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();

        var created = client.post()
                .uri("/api/salon/{salonId}/booking", salonId)
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
                .uri("/api/salon-admin/{salonId}/booking/{bookingId}", salonId, bookingId)
                .exchange()
                .expectStatus().isNoContent();

        client.get()
                .uri("/api/salon-admin/{salonId}/booking/{bookingId}", salonId, bookingId)
                .exchange()
                .expectStatus().isNotFound();
    }
}
