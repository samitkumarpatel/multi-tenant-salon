package net.samitkumar.multi_tenant_salon.salon.internal;

import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonClosure;
import net.samitkumar.multi_tenant_salon.salon.SalonHoliday;
import net.samitkumar.multi_tenant_salon.salon.SalonOpeningDay;
import net.samitkumar.multi_tenant_salon.salon.SalonOpeningDay.Status;

import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Resolves a salon's real opening per date, in priority order: a one-off closure (holidays are
 * also materialised as closures linked by {@code holidayId}), then a named holiday that has no
 * closure row (e.g. a recurring holiday beyond the materialised years), then the weekly hours.
 */
final class OpeningCalendar {

    private OpeningCalendar() {}

    static List<SalonOpeningDay> resolve(List<Salon.OperatingHours> hours, List<SalonClosure> closures,
                                         List<SalonHoliday> holidays, LocalDate from, LocalDate to) {
        var days = new ArrayList<SalonOpeningDay>();
        for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
            days.add(resolve(hours, closures, holidays, date));
        }
        return days;
    }

    static SalonOpeningDay resolve(List<Salon.OperatingHours> hours, List<SalonClosure> closures,
                                   List<SalonHoliday> holidays, LocalDate date) {
        DayOfWeek weekday = date.getDayOfWeek();
        Optional<SalonClosure> closure = closures.stream()
                .filter(c -> !date.isBefore(c.startDate()) && !date.isAfter(c.endDate()))
                .findFirst();
        if (closure.isPresent()) {
            var c = closure.get();
            boolean holiday = c.holidayId() != null;
            String reason = c.reason() != null && !c.reason().isBlank() ? c.reason().strip()
                    : holiday ? "Holiday" : "Closed for the day";
            return new SalonOpeningDay(date, weekday, holiday ? Status.CLOSED_HOLIDAY : Status.CLOSED_SPECIAL, null, null, reason);
        }
        Optional<SalonHoliday> holiday = holidays.stream().filter(h -> covers(h, date)).findFirst();
        if (holiday.isPresent()) {
            return new SalonOpeningDay(date, weekday, Status.CLOSED_HOLIDAY, null, null, holiday.get().name());
        }
        if (hours == null || hours.isEmpty()) {
            return new SalonOpeningDay(date, weekday, Status.HOURS_NOT_SET, null, null, null);
        }
        return hours.stream().filter(h -> h.day() == weekday).findFirst()
                .filter(h -> !h.closed() && h.openTime() != null && h.closeTime() != null)
                .map(h -> new SalonOpeningDay(date, weekday, Status.OPEN, h.openTime(), h.closeTime(), null))
                .orElseGet(() -> new SalonOpeningDay(date, weekday, Status.CLOSED_WEEKLY, null, null,
                        "Closed on " + weekday.getDisplayName(TextStyle.FULL, Locale.ENGLISH) + "s"));
    }

    /**
     * Whether a holiday covers the date. A range whose end falls before its start in the calendar
     * crosses the new year (Dec 24 – Jan 2), so it may have started in the previous year.
     */
    static boolean covers(SalonHoliday holiday, LocalDate date) {
        for (int year = date.getYear() - 1; year <= date.getYear(); year++) {
            if (holiday.year() != null && holiday.year() != year) continue;
            try {
                LocalDate start = LocalDate.of(year, holiday.month(), holiday.day());
                int endMonth = holiday.endMonth() != null ? holiday.endMonth() : holiday.month();
                int endDay = holiday.endDay() != null ? holiday.endDay() : holiday.day();
                LocalDate end = LocalDate.of(year, endMonth, endDay);
                if (end.isBefore(start)) end = LocalDate.of(year + 1, endMonth, endDay);
                if (!date.isBefore(start) && !date.isAfter(end)) return true;
            } catch (DateTimeException ignored) {
                // Feb 29 in a non-leap year — the holiday simply doesn't occur that year
            }
        }
        return false;
    }
}
