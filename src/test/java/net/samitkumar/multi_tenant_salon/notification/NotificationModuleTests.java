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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Import;
import org.springframework.modulith.test.ApplicationModuleTest;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;

@ApplicationModuleTest(mode = ApplicationModuleTest.BootstrapMode.ALL_DEPENDENCIES)
@Import(TestcontainersConfiguration.class)
class NotificationModuleTests {

    @Autowired
    ApplicationEventPublisher eventPublisher;

    // ── Salon events ─────────────────────────────────────────────────────────

    @Test
    void handlesSalonCreatedEventWithoutError() {
        var event = new SalonCreatedEvent(
                UUID.randomUUID(), "Test Salon", "test-salon", "Jane Doe", "jane@test.com", "+1234567890",
                List.of(SalonFeature.BOOKING, SalonFeature.STATIC_WEBSITE));

        assertThatCode(() -> eventPublisher.publishEvent(event))
                .doesNotThrowAnyException();
    }

    @Test
    void handlesSalonCreatedEventWithNoFeatures() {
        var event = new SalonCreatedEvent(
                UUID.randomUUID(), "Minimal Salon", "minimal-salon", "Bob", "bob@min.com", null, List.of());

        assertThatCode(() -> eventPublisher.publishEvent(event))
                .doesNotThrowAnyException();
    }

    @Test
    void handlesSalonUpdatedEventWithoutError() {
        var event = new SalonUpdatedEvent(
                UUID.randomUUID(), "Test Salon", "test-salon", "Jane Doe", "jane@test.com");

        assertThatCode(() -> eventPublisher.publishEvent(event))
                .doesNotThrowAnyException();
    }

    // ── Booking lifecycle events ───────────────────────────────────────────────

    @Test
    void handlesBookingCreatedEventWithoutError() {
        var event = new BookingCreatedEvent(
                1L, UUID.randomUUID(), 1L, 1L,
                "John Doe", "john@doe.com", "+1234567890",
                LocalDate.of(2027, 1, 4), LocalTime.of(10, 0), LocalTime.of(11, 0));

        assertThatCode(() -> eventPublisher.publishEvent(event))
                .doesNotThrowAnyException();
    }

    @Test
    void handlesBookingConfirmedStatusChange() {
        var event = new BookingStatusChangedEvent(
                2L, UUID.randomUUID(), BookingStatus.CONFIRMED,
                "Alice Smith", "alice@example.com", "+9876543210",
                LocalDate.of(2027, 2, 10), LocalTime.of(14, 0), LocalTime.of(15, 0));

        assertThatCode(() -> eventPublisher.publishEvent(event))
                .doesNotThrowAnyException();
    }

    @Test
    void handlesBookingCancelledStatusChange() {
        var event = new BookingStatusChangedEvent(
                3L, UUID.randomUUID(), BookingStatus.CANCELLED,
                "Bob Jones", "bob@example.com", null,
                LocalDate.of(2027, 3, 5), LocalTime.of(9, 0), LocalTime.of(9, 30));

        assertThatCode(() -> eventPublisher.publishEvent(event))
                .doesNotThrowAnyException();
    }

    @Test
    void handlesBookingCompletedStatusChange() {
        var event = new BookingStatusChangedEvent(
                4L, UUID.randomUUID(), BookingStatus.COMPLETED,
                "Carol White", "carol@example.com", "+1122334455",
                LocalDate.of(2027, 1, 20), LocalTime.of(11, 0), LocalTime.of(11, 45));

        assertThatCode(() -> eventPublisher.publishEvent(event))
                .doesNotThrowAnyException();
    }

    @Test
    void handlesBookingNoShowStatusChange() {
        var event = new BookingStatusChangedEvent(
                5L, UUID.randomUUID(), BookingStatus.NO_SHOW,
                "Dave Brown", "dave@example.com", null,
                LocalDate.of(2027, 4, 1), LocalTime.of(16, 0), LocalTime.of(17, 0));

        assertThatCode(() -> eventPublisher.publishEvent(event))
                .doesNotThrowAnyException();
    }

    @Test
    void handlesBookingRescheduledEvent() {
        var event = new BookingRescheduledEvent(
                6L, UUID.randomUUID(), 2L,
                "Eve Green", "eve@example.com", "+5556667777",
                LocalDate.of(2027, 5, 15), LocalTime.of(10, 30), LocalTime.of(11, 30));

        assertThatCode(() -> eventPublisher.publishEvent(event))
                .doesNotThrowAnyException();
    }

    @Test
    void handlesStaffBookingAssignedEventWithoutError() {
        var event = new StaffBookingAssignedEvent(
                7L, UUID.randomUUID(), 3L, "Sam Stylist", "sam@salon.com",
                1L, "Frank Client", LocalDate.of(2027, 7, 1), LocalTime.of(13, 0), LocalTime.of(14, 0));

        assertThatCode(() -> eventPublisher.publishEvent(event))
                .doesNotThrowAnyException();
    }

    @Test
    void handlesStaffBookingAssignedEventWithoutStaffEmail() {
        var event = new StaffBookingAssignedEvent(
                8L, UUID.randomUUID(), 4L, "No Email Stylist", null,
                1L, "Grace Client", LocalDate.of(2027, 7, 2), LocalTime.of(15, 0), LocalTime.of(16, 0));

        assertThatCode(() -> eventPublisher.publishEvent(event))
                .doesNotThrowAnyException();
    }

    // ── Calendar / availability events ────────────────────────────────────────

    @Test
    void handlesStaffScheduleUpdatedEvent() {
        var event = new StaffScheduleUpdatedEvent(UUID.randomUUID(), 1L, 5);

        assertThatCode(() -> eventPublisher.publishEvent(event))
                .doesNotThrowAnyException();
    }

    @Test
    void handlesStaffAvailabilityOverrideAddedEvent() {
        var event = new StaffAvailabilityOverrideAddedEvent(
                UUID.randomUUID(), 1L, 10L,
                LocalDate.of(2027, 6, 1),
                LocalTime.of(9, 0), LocalTime.of(13, 0),
                true, "Half-day availability");

        assertThatCode(() -> eventPublisher.publishEvent(event))
                .doesNotThrowAnyException();
    }

    @Test
    void handlesStaffAvailabilityOverrideAddedWithUnavailableDay() {
        var event = new StaffAvailabilityOverrideAddedEvent(
                UUID.randomUUID(), 2L, 11L,
                LocalDate.of(2027, 6, 10),
                null, null,
                false, "Staff on leave");

        assertThatCode(() -> eventPublisher.publishEvent(event))
                .doesNotThrowAnyException();
    }

    @Test
    void handlesStaffAvailabilityOverrideRemovedEvent() {
        var event = new StaffAvailabilityOverrideRemovedEvent(
                UUID.randomUUID(), 1L, 10L, LocalDate.of(2027, 6, 1));

        assertThatCode(() -> eventPublisher.publishEvent(event))
                .doesNotThrowAnyException();
    }
}
