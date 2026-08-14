package net.samitkumar.multi_tenant_salon.notification.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.booking.BookingCreatedEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingRescheduledEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingStatusChangedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverrideAddedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverrideRemovedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffScheduleUpdatedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@Slf4j
class BookingNotificationListener {

    @ApplicationModuleListener
    void onBookingCreated(BookingCreatedEvent event) {
        log.info("""
                [NOTIFICATION → CUSTOMER] Booking confirmed — details below.
                  To          : {} <{}>
                  Booking #   : {}  (salon: {})
                  Date/Time   : {} {} – {}
                  Service     : {}  Staff: {}
                """,
                event.customerName(), event.customerEmail(),
                event.bookingId(), event.salonId(),
                event.appointmentDate(), event.startTime(), event.endTime(),
                event.serviceId(), event.staffId());
    }

    @ApplicationModuleListener
    void onBookingStatusChanged(BookingStatusChangedEvent event) {
        String message = switch (event.newStatus()) {
            case CONFIRMED  -> "Your booking has been confirmed by the salon.";
            case CANCELLED  -> "Your booking has been cancelled. We hope to see you another time.";
            case COMPLETED  -> "Thank you for your visit! Your appointment is now marked complete.";
            case NO_SHOW    -> "Your appointment was marked as no-show. Please contact the salon if this is incorrect.";
            default         -> "Your booking status has been updated to " + event.newStatus() + ".";
        };
        log.info("""
                [NOTIFICATION → CUSTOMER] Booking status update.
                  To          : {} <{}>
                  Booking #   : {}  (salon: {})
                  Status      : {}
                  Date/Time   : {} {} – {}
                  Message     : {}
                """,
                event.customerName(), event.customerEmail(),
                event.bookingId(), event.salonId(),
                event.newStatus(),
                event.appointmentDate(), event.startTime(), event.endTime(),
                message);
    }

    @ApplicationModuleListener
    void onBookingRescheduled(BookingRescheduledEvent event) {
        log.info("""
                [NOTIFICATION → CUSTOMER] Your appointment has been rescheduled.
                  To          : {} <{}>
                  Booking #   : {}  (salon: {})
                  New Date    : {}  {} – {}
                  Staff       : {}
                """,
                event.customerName(), event.customerEmail(),
                event.bookingId(), event.salonId(),
                event.newAppointmentDate(), event.newStartTime(), event.newEndTime(),
                event.staffId());
    }

    @ApplicationModuleListener
    void onStaffScheduleUpdated(StaffScheduleUpdatedEvent event) {
        log.info("""
                [NOTIFICATION → ADMIN] Staff weekly schedule updated.
                  Salon      : {}
                  Staff       : {}
                  Entries set : {}
                """,
                event.salonId(), event.staffId(), event.scheduleEntriesCount());
    }

    @ApplicationModuleListener
    void onStaffAvailabilityOverrideAdded(StaffAvailabilityOverrideAddedEvent event) {
        log.info("""
                [NOTIFICATION → ADMIN] Staff availability override added.
                  Salon      : {}
                  Staff       : {}
                  Override #  : {}  Date: {}
                  Available   : {}  ({} – {})
                  Reason      : {}
                """,
                event.salonId(), event.staffId(),
                event.overrideId(), event.overrideDate(),
                event.available(), event.startTime(), event.endTime(),
                event.reason() != null ? event.reason() : "—");
    }

    @ApplicationModuleListener
    void onStaffAvailabilityOverrideRemoved(StaffAvailabilityOverrideRemovedEvent event) {
        log.info("""
                [NOTIFICATION → ADMIN] Staff availability override removed.
                  Salon      : {}
                  Staff       : {}
                  Override #  : {}  Date: {}
                """,
                event.salonId(), event.staffId(), event.overrideId(), event.overrideDate());
    }
}
