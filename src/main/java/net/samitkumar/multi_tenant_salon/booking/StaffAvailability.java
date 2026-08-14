package net.samitkumar.multi_tenant_salon.booking;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.UUID;

@Table("staff_availability")
public record StaffAvailability(
        @Id Long id,
        UUID salonId,
        Long staffId,
        DayOfWeek dayOfWeek,
        LocalTime startTime,
        LocalTime endTime,
        boolean available
) {}
