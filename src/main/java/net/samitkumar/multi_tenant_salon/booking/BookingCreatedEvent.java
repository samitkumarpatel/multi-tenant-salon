package net.samitkumar.multi_tenant_salon.booking;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record BookingCreatedEvent(
        Long bookingId,
        UUID salonId,
        Long serviceId,
        Long staffId,
        String customerName,
        String customerEmail,
        String customerPhone,
        LocalDate appointmentDate,
        LocalTime startTime,
        LocalTime endTime
) {}
