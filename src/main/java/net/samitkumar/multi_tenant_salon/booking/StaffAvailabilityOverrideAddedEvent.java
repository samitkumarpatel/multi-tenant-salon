package net.samitkumar.multi_tenant_salon.booking;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record StaffAvailabilityOverrideAddedEvent(
        UUID salonId,
        Long staffId,
        Long overrideId,
        LocalDate overrideDate,
        LocalTime startTime,
        LocalTime endTime,
        boolean available,
        String reason
) {}
