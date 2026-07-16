package net.samitkumar.multi_tenant_saloon.booking;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record BookingStatusChangedEvent(
        Long bookingId,
        UUID saloonId,
        BookingStatus newStatus,
        String customerName,
        String customerEmail,
        String customerPhone,
        LocalDate appointmentDate,
        LocalTime startTime,
        LocalTime endTime
) {}
