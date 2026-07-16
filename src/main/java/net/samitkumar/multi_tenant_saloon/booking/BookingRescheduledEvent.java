package net.samitkumar.multi_tenant_saloon.booking;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record BookingRescheduledEvent(
        Long bookingId,
        UUID saloonId,
        Long staffId,
        String customerName,
        String customerEmail,
        String customerPhone,
        LocalDate newAppointmentDate,
        LocalTime newStartTime,
        LocalTime newEndTime
) {}
