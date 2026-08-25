package net.samitkumar.multi_tenant_salon.booking;

import java.util.UUID;

public record StaffScheduleUpdatedEvent(
        UUID salonId,
        Long staffId,
        String staffName,
        String staffEmail,
        int scheduleEntriesCount
) {}
