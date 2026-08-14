package net.samitkumar.multi_tenant_salon.booking;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

@Table("booking")
public record Booking(
        @Id Long id,
        UUID salonId,
        Long serviceId,
        Long staffId,
        String customerName,
        String customerEmail,
        String customerPhone,
        LocalDate appointmentDate,
        LocalTime startTime,
        LocalTime endTime,
        BookingStatus status,
        String notes,
        Instant createdAt
) {}
