package net.samitkumar.multi_tenant_salon.booking;

import java.time.LocalDate;
import java.util.UUID;

public record StaffAvailabilityOverrideRemovedEvent(
        UUID salonId,
        Long staffId,
        Long overrideId,
        LocalDate overrideDate
) {}
