package net.samitkumar.multi_tenant_salon.booking;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/** Published when a new booking is assigned to a staff member, so they can be notified. */
public record StaffBookingAssignedEvent(
        Long bookingId,
        UUID salonId,
        Long staffId,
        String staffName,
        String staffEmail,
        Long serviceId,
        String customerName,
        LocalDate appointmentDate,
        LocalTime startTime,
        LocalTime endTime
) {}
