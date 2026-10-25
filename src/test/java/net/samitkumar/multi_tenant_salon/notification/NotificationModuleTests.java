package net.samitkumar.multi_tenant_salon.notification;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import net.samitkumar.multi_tenant_salon.booking.BookingCreatedEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingRescheduledEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import net.samitkumar.multi_tenant_salon.booking.BookingStatusChangedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverrideAddedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverrideRemovedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffScheduleUpdatedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffBookingAssignedEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonCreatedEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.salon.SalonUpdatedEvent;
import net.samitkumar.multi_tenant_salon.staff.StaffOnboardedEvent;
import net.samitkumar.multi_tenant_salon.staff.StaffRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

@ApplicationModuleTest(mode = ApplicationModuleTest.BootstrapMode.ALL_DEPENDENCIES)
@Import(TestcontainersConfiguration.class)
class NotificationModuleTests {

    @Autowired
    ApplicationEventPublisher eventPublisher;
    @Autowired
    PlatformTransactionManager transactionManager;
    @Autowired
    JdbcTemplate jdbc;

    /**
     * Publishes like production code does — inside a transaction, so Spring Modulith stores the event —
     * and waits until every module listener has handled it: delivered publications are archived out of
     * {@code event_publication}, while a listener that threw would leave its row there as FAILED.
     */
    private void publishAndAwaitDelivery(Object event) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> eventPublisher.publishEvent(event));
        await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM event_publication WHERE event_type = ?", Integer.class, event.getClass().getName()))
                .as("undelivered %s publications", event.getClass().getSimpleName()).isZero());
    }

    // ── Salon events ─────────────────────────────────────────────────────────

    @Test
    void handlesSalonCreatedEventWithoutError() {
        var event = new SalonCreatedEvent(
                UUID.randomUUID(), "Test Salon", "test-salon", "Jane Doe", "jane@test.com", "+1234567890",
                List.of(SalonFeature.BOOKING, SalonFeature.STATIC_WEBSITE));

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesSalonCreatedEventWithNoFeatures() {
        var event = new SalonCreatedEvent(
                UUID.randomUUID(), "Minimal Salon", "minimal-salon", "Bob", "bob@min.com", null, List.of());

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesSalonUpdatedEventWithoutError() {
        var event = new SalonUpdatedEvent(
                UUID.randomUUID(), "Test Salon", "test-salon", "Jane Doe", "jane@test.com");

        publishAndAwaitDelivery(event);
    }

    // ── Booking lifecycle events ───────────────────────────────────────────────

    @Test
    void handlesBookingPaymentLinkEventWithoutError() {
        var event = new net.samitkumar.multi_tenant_salon.booking.BookingPaymentLinkEvent(
                1L, UUID.randomUUID(), "John Doe", "john@doe.com",
                LocalDate.of(2027, 1, 4), LocalTime.of(10, 0), "Cut", new java.math.BigDecimal("40.00"), "EUR",
                "https://checkout.stripe.com/c/pay/cs_1", "Test Salon", "+1112223333", "salon@test.com");

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesBookingCreatedEventWithoutError() {
        var event = new BookingCreatedEvent(
                1L, UUID.randomUUID(), 1L, 1L,
                "John Doe", "john@doe.com", "+1234567890",
                LocalDate.of(2027, 1, 4), LocalTime.of(10, 0), LocalTime.of(11, 0),
                BookingStatus.PENDING,
                "Test Salon", "+1112223333", "salon@test.com");

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesBookingCreatedEventWithAutoConfirmWithoutError() {
        var event = new BookingCreatedEvent(
                9L, UUID.randomUUID(), 1L, 1L,
                "Jill Auto", "jill@auto.com", "+1234567890",
                LocalDate.of(2027, 1, 5), LocalTime.of(10, 0), LocalTime.of(11, 0),
                BookingStatus.CONFIRMED,
                "Test Salon", "+1112223333", "salon@test.com");

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesBookingConfirmedStatusChange() {
        var event = new BookingStatusChangedEvent(
                2L, UUID.randomUUID(), BookingStatus.CONFIRMED,
                "Alice Smith", "alice@example.com", "+9876543210",
                LocalDate.of(2027, 2, 10), LocalTime.of(14, 0), LocalTime.of(15, 0),
                "Test Salon", "+1112223333", "salon@test.com");

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesBookingCancelledStatusChange() {
        var event = new BookingStatusChangedEvent(
                3L, UUID.randomUUID(), BookingStatus.CANCELLED,
                "Bob Jones", "bob@example.com", null,
                LocalDate.of(2027, 3, 5), LocalTime.of(9, 0), LocalTime.of(9, 30),
                "Test Salon", null, null);

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesBookingCompletedStatusChange() {
        var event = new BookingStatusChangedEvent(
                4L, UUID.randomUUID(), BookingStatus.COMPLETED,
                "Carol White", "carol@example.com", "+1122334455",
                LocalDate.of(2027, 1, 20), LocalTime.of(11, 0), LocalTime.of(11, 45),
                "Test Salon", "+1112223333", "salon@test.com");

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesBookingNoShowStatusChange() {
        var event = new BookingStatusChangedEvent(
                5L, UUID.randomUUID(), BookingStatus.NO_SHOW,
                "Dave Brown", "dave@example.com", null,
                LocalDate.of(2027, 4, 1), LocalTime.of(16, 0), LocalTime.of(17, 0),
                "Test Salon", "+1112223333", "salon@test.com");

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesBookingRescheduledEvent() {
        var event = new BookingRescheduledEvent(
                6L, UUID.randomUUID(), 2L,
                "Eve Green", "eve@example.com", "+5556667777",
                LocalDate.of(2027, 5, 15), LocalTime.of(10, 30), LocalTime.of(11, 30),
                "Test Salon", "+1112223333", "salon@test.com");

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesStaffBookingAssignedEventWithoutError() {
        var event = new StaffBookingAssignedEvent(
                7L, UUID.randomUUID(), 3L, "Sam Stylist", "sam@salon.com",
                1L, "Frank Client", LocalDate.of(2027, 7, 1), LocalTime.of(13, 0), LocalTime.of(14, 0));

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesStaffBookingAssignedEventWithoutStaffEmail() {
        var event = new StaffBookingAssignedEvent(
                8L, UUID.randomUUID(), 4L, "No Email Stylist", null,
                1L, "Grace Client", LocalDate.of(2027, 7, 2), LocalTime.of(15, 0), LocalTime.of(16, 0));

        publishAndAwaitDelivery(event);
    }

    // ── Staff onboarding ────────────────────────────────────────────────────────

    @Test
    void handlesStaffOnboardedEventWithoutError() {
        var event = new StaffOnboardedEvent(
                UUID.randomUUID(), 20L, "New Hire", "newhire@salon.com", StaffRole.STYLIST,
                "Test Salon", "test-salon", List.of());

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesStaffOnboardedEventWithoutStaffEmail() {
        var event = new StaffOnboardedEvent(
                UUID.randomUUID(), 21L, "No Email Hire", null, StaffRole.RECEPTIONIST,
                "Test Salon", "test-salon", List.of());

        publishAndAwaitDelivery(event);
    }

    // ── Calendar / availability events ────────────────────────────────────────

    @Test
    void handlesStaffScheduleUpdatedEvent() {
        var event = new StaffScheduleUpdatedEvent(UUID.randomUUID(), 1L, "Sam Stylist", "sam@salon.com", 5);

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesStaffScheduleUpdatedEventWithoutStaffEmail() {
        var event = new StaffScheduleUpdatedEvent(UUID.randomUUID(), 1L, "No Email Stylist", null, 5);

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesStaffAvailabilityOverrideAddedEvent() {
        var event = new StaffAvailabilityOverrideAddedEvent(
                UUID.randomUUID(), 1L, "Sam Stylist", "sam@salon.com", 10L,
                LocalDate.of(2027, 6, 1),
                LocalTime.of(9, 0), LocalTime.of(13, 0),
                true, "Half-day availability");

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesStaffAvailabilityOverrideAddedWithUnavailableDay() {
        var event = new StaffAvailabilityOverrideAddedEvent(
                UUID.randomUUID(), 2L, "Terry Tech", "terry@salon.com", 11L,
                LocalDate.of(2027, 6, 10),
                null, null,
                false, "Staff on leave");

        publishAndAwaitDelivery(event);
    }

    @Test
    void handlesStaffAvailabilityOverrideRemovedEvent() {
        var event = new StaffAvailabilityOverrideRemovedEvent(
                UUID.randomUUID(), 1L, "Sam Stylist", "sam@salon.com", 10L, LocalDate.of(2027, 6, 1));

        publishAndAwaitDelivery(event);
    }
}
