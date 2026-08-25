package net.samitkumar.multi_tenant_salon.booking;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.context.WebApplicationContext;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Regression coverage for a bug where BookingService.updateStatus/reschedule/delete
 * published their events outside of any transaction (they were missing @Transactional,
 * unlike create()). Since the notification module's listeners are AFTER_COMMIT
 * @ApplicationModuleListeners, events published without an active transaction are
 * silently dropped and no customer email goes out on confirm/cancel/complete/no-show/
 * reschedule/delete.
 *
 * These tests don't depend on the notification module's internals; they register a
 * plain AFTER_COMMIT @TransactionalEventListener (the same delivery mechanism
 * @ApplicationModuleListener relies on) and assert it actually observes the event
 * after each booking-mutating endpoint call.
 */
@ApplicationModuleTest(mode = ApplicationModuleTest.BootstrapMode.ALL_DEPENDENCIES)
@Import({TestcontainersConfiguration.class, BookingNotificationDeliveryTests.EventCaptureConfig.class})
class BookingNotificationDeliveryTests {

    @Autowired
    JdbcTemplate jdbcTemplate;

    @Autowired
    EventCapture eventCapture;

    RestTestClient client;
    UUID salonId;
    String serviceId;
    String staffId;

    // Fixed Monday in the future for deterministic availability
    static final String TEST_DATE = "2027-01-04";

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();

        salonId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO salon (id, name, handler, owner_name, owner_email, created_at) VALUES (?, ?, ?, ?, ?, now())",
                salonId, "Notify Test Salon", "notify-test-" + salonId.toString().substring(0, 8),
                "Test Owner", "test@notify.com");

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

        client.put()
                .uri("/api/salon-admin/{salonId}/staff/{staffId}/availability", salonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        [{"dayOfWeek": "MONDAY", "startTime": "09:00", "endTime": "17:00", "available": true}]
                        """)
                .exchange()
                .expectStatus().isOk();
    }

    private String createBooking(String startTime, String customerEmail) {
        var created = client.post()
                .uri("/api/salon/{salonId}/booking", salonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "serviceId": %s,
                            "staffId": %s,
                            "customerName": "Notify Customer",
                            "customerEmail": "%s",
                            "appointmentDate": "%s",
                            "startTime": "%s"
                        }
                        """.formatted(serviceId, staffId, customerEmail, TEST_DATE, startTime))
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Void.class)
                .returnResult();
        return created.getResponseHeaders().getLocation().getPath().replaceAll(".*/", "");
    }

    @Test
    void cancellingBookingDeliversStatusChangedEventAfterCommit() {
        String bookingId = createBooking("09:00", "cancel-notify@test.com");

        client.post()
                .uri("/api/salon-admin/{salonId}/booking/{bookingId}/cancel", salonId, bookingId)
                .exchange()
                .expectStatus().isOk();

        assertThat(eventCapture.statusChangedTo(Long.valueOf(bookingId), BookingStatus.CANCELLED)).isTrue();
    }

    @Test
    void completingBookingDeliversStatusChangedEventAfterCommit() {
        String bookingId = createBooking("10:00", "complete-notify@test.com");

        client.post()
                .uri("/api/salon-admin/{salonId}/booking/{bookingId}/complete", salonId, bookingId)
                .exchange()
                .expectStatus().isOk();

        assertThat(eventCapture.statusChangedTo(Long.valueOf(bookingId), BookingStatus.COMPLETED)).isTrue();
    }

    @Test
    void markingNoShowDeliversStatusChangedEventAfterCommit() {
        String bookingId = createBooking("11:00", "noshow-notify@test.com");

        client.post()
                .uri("/api/salon-admin/{salonId}/booking/{bookingId}/no-show", salonId, bookingId)
                .exchange()
                .expectStatus().isOk();

        assertThat(eventCapture.statusChangedTo(Long.valueOf(bookingId), BookingStatus.NO_SHOW)).isTrue();
    }

    @Test
    void reschedulingBookingDeliversRescheduledEventAfterCommit() {
        String bookingId = createBooking("12:00", "reschedule-notify@test.com");

        client.put()
                .uri("/api/salon-admin/{salonId}/booking/{bookingId}", salonId, bookingId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "appointmentDate": "%s",
                            "startTime": "14:00"
                        }
                        """.formatted(TEST_DATE))
                .exchange()
                .expectStatus().isOk();

        assertThat(eventCapture.rescheduled(Long.valueOf(bookingId))).isTrue();
    }

    @Test
    void deletingBookingDeliversCancelledStatusChangedEventAfterCommit() {
        String bookingId = createBooking("15:00", "delete-notify@test.com");

        client.delete()
                .uri("/api/salon-admin/{salonId}/booking/{bookingId}", salonId, bookingId)
                .exchange()
                .expectStatus().isNoContent();

        assertThat(eventCapture.statusChangedTo(Long.valueOf(bookingId), BookingStatus.CANCELLED)).isTrue();
    }

    @TestConfiguration
    static class EventCaptureConfig {
        @Bean
        EventCapture eventCapture() {
            return new EventCapture();
        }
    }

    /**
     * Deliberately not @Async, unlike @ApplicationModuleListener: firing synchronously
     * on the request thread right after commit means the assertion right after
     * client.exchange() returns doesn't need polling.
     */
    static class EventCapture {
        private final List<Object> events = new CopyOnWriteArrayList<>();

        @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
        void onStatusChanged(BookingStatusChangedEvent event) {
            events.add(event);
        }

        @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
        void onRescheduled(BookingRescheduledEvent event) {
            events.add(event);
        }

        boolean statusChangedTo(Long bookingId, BookingStatus status) {
            return events.stream().anyMatch(e -> e instanceof BookingStatusChangedEvent evt
                    && evt.bookingId().equals(bookingId) && evt.newStatus() == status);
        }

        boolean rescheduled(Long bookingId) {
            return events.stream().anyMatch(e -> e instanceof BookingRescheduledEvent evt
                    && evt.bookingId().equals(bookingId));
        }
    }
}
