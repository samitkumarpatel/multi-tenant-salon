package net.samitkumar.multi_tenant_salon.booking;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Answer to a flexible availability query (<code>GET /api/salon/{id}/availability</code>) —
 * one call that covers "which days can I come in", "what times on this day", "which days does
 * this stylist work", and "who is free on this day". Each {@link DayAvailability} carries a
 * {@link DayStatus} and, when not {@code OPEN}, a human {@code reason} so callers (and the chat
 * assistant) never have to guess why a day is blocked.
 *
 * @param staffId         the stylist the query was scoped to, or {@code null} for "any stylist"
 * @param days            one entry per date in {@code [from, to]}; when {@code limit} was given,
 *                        only the first {@code limit} {@link DayStatus#OPEN} days
 * @param firstAvailable  the earliest bookable slot in the range, or {@code null} if none
 */
public record SalonAvailability(
        Long serviceId,
        String serviceName,
        int durationMinutes,
        Long staffId,
        LocalDate from,
        LocalDate to,
        List<DayAvailability> days,
        FirstAvailable firstAvailable
) {
    public enum DayStatus {
        /** At least one unbooked slot exists. */
        OPEN,
        /** Salon-wide closed: a holiday, a one-off closure, or a non-working weekday. */
        SALON_CLOSED,
        /** Salon is open but no candidate stylist is scheduled to work. */
        STAFF_OFF,
        /** Stylist(s) working, but every slot is already taken. */
        FULLY_BOOKED
    }

    /** Whether {@link DayAvailability#slots()} is populated. */
    public enum Granularity { DAY, SLOT }

    public record DayAvailability(
            LocalDate date,
            DayOfWeek weekday,
            DayStatus status,
            String reason,
            int openSlotCount,
            LocalTime firstOpenTime,
            List<Long> availableStaffIds,
            List<AvailableSlot> slots
    ) {}

    public record FirstAvailable(LocalDate date, LocalTime startTime, Long staffId) {}
}
