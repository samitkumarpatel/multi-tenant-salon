package net.samitkumar.multi_tenant_salon.booking;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

@Table("staff_availability_override")
public record StaffAvailabilityOverride(
        @Id Long id,
        UUID salonId,
        Long staffId,
        LocalDate overrideDate,
        LocalTime startTime,
        LocalTime endTime,
        boolean available,
        String reason
) {}
