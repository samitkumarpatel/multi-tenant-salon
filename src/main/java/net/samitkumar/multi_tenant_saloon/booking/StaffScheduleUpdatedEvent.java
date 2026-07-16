package net.samitkumar.multi_tenant_saloon.booking;

import java.util.UUID;

public record StaffScheduleUpdatedEvent(
        UUID saloonId,
        Long staffId,
        int scheduleEntriesCount
) {}
