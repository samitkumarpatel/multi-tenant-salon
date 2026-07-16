package net.samitkumar.multi_tenant_saloon.booking;

import java.time.LocalDate;
import java.util.UUID;

public record StaffAvailabilityOverrideRemovedEvent(
        UUID saloonId,
        Long staffId,
        Long overrideId,
        LocalDate overrideDate
) {}
