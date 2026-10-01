package net.samitkumar.multi_tenant_salon.booking;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record BookingStatusChangedEvent(
        Long bookingId,
        UUID salonId,
        BookingStatus newStatus,
        String customerName,
        String customerEmail,
        String customerPhone,
        LocalDate appointmentDate,
        LocalTime startTime,
        LocalTime endTime,
        String salonName,
        String salonPhone,
        String salonEmail,
        String reviewToken
) {
    public BookingStatusChangedEvent(Long bookingId, UUID salonId, BookingStatus newStatus,
                                     String customerName, String customerEmail, String customerPhone,
                                     LocalDate appointmentDate, LocalTime startTime, LocalTime endTime,
                                     String salonName, String salonPhone, String salonEmail) {
        this(bookingId, salonId, newStatus, customerName, customerEmail, customerPhone,
                appointmentDate, startTime, endTime, salonName, salonPhone, salonEmail, null);
    }
}
