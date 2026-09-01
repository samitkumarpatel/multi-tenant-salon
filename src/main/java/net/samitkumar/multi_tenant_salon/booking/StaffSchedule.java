package net.samitkumar.multi_tenant_salon.booking;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

/**
 * The days a staff member is never bookable: {@code closedWeekdays} from their recurring weekly
 * schedule (a day with no {@code available} {@link StaffAvailability} row), plus {@code
 * closedDates} from one-off unavailable {@link StaffAvailabilityOverride}s. Lets a booking UI
 * grey out a calendar for a specific staff member instead of only the salon-wide closed days.
 */
public record StaffSchedule(Set<DayOfWeek> closedWeekdays, List<LocalDate> closedDates) {}
