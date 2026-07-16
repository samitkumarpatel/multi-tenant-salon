package net.samitkumar.multi_tenant_saloon.booking;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

public record StaffAvailabilityOverrideAddedEvent(
        UUID saloonId,
        Long staffId,
        Long overrideId,
        LocalDate overrideDate,
        LocalTime startTime,
        LocalTime endTime,
        boolean available,
        String reason
) {}
