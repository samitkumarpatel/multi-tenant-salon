package net.samitkumar.multi_tenant_salon.notification.internal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.booking.BookingCreatedEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingRescheduledEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingStatusChangedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverrideAddedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverrideRemovedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffBookingAssignedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffScheduleUpdatedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
class BookingNotificationListener {

    private final NotificationService notificationService;

    @ApplicationModuleListener
    void onBookingCreated(BookingCreatedEvent event) {
        log.info("[NOTIFICATION → CUSTOMER] Booking #{} received — notifying {} <{}>",
                event.bookingId(), event.customerName(), event.customerEmail());
        notificationService.notifyBookingCreated(event);
    }

    @ApplicationModuleListener
    void onBookingStatusChanged(BookingStatusChangedEvent event) {
        log.info("[NOTIFICATION → CUSTOMER] Booking #{} status changed to {} — notifying {} <{}>",
                event.bookingId(), event.newStatus(), event.customerName(), event.customerEmail());
        notificationService.notifyBookingStatusChanged(event);
    }

    @ApplicationModuleListener
    void onBookingRescheduled(BookingRescheduledEvent event) {
        log.info("[NOTIFICATION → CUSTOMER] Booking #{} rescheduled — notifying {} <{}>",
                event.bookingId(), event.customerName(), event.customerEmail());
        notificationService.notifyBookingRescheduled(event);
    }

    @ApplicationModuleListener
    void onStaffBookingAssigned(StaffBookingAssignedEvent event) {
        log.info("[NOTIFICATION → STAFF] Booking #{} assigned to staff {} <{}>",
                event.bookingId(), event.staffName(), event.staffEmail());
        notificationService.notifyStaffBookingAssigned(event);
    }

    @ApplicationModuleListener
    void onStaffScheduleUpdated(StaffScheduleUpdatedEvent event) {
        log.info("[NOTIFICATION → STAFF] Weekly schedule updated for staff {} <{}> — {} entries",
                event.staffName(), event.staffEmail(), event.scheduleEntriesCount());
        notificationService.notifyStaffScheduleUpdated(event);
    }

    @ApplicationModuleListener
    void onStaffAvailabilityOverrideAdded(StaffAvailabilityOverrideAddedEvent event) {
        log.info("[NOTIFICATION → STAFF] Availability override added for staff {} <{}> on {}",
                event.staffName(), event.staffEmail(), event.overrideDate());
        notificationService.notifyStaffAvailabilityOverrideAdded(event);
    }

    @ApplicationModuleListener
    void onStaffAvailabilityOverrideRemoved(StaffAvailabilityOverrideRemovedEvent event) {
        log.info("[NOTIFICATION → STAFF] Availability override removed for staff {} <{}> on {}",
                event.staffName(), event.staffEmail(), event.overrideDate());
        notificationService.notifyStaffAvailabilityOverrideRemoved(event);
    }
}
