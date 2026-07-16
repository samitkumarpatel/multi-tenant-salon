package net.samitkumar.multi_tenant_saloon.staff;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record StaffOnboardedEvent(UUID saloonId, Long staffId, List<DaySchedule> schedule) {
    public record DaySchedule(DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime) {}
}
