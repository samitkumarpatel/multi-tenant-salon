package net.samitkumar.multi_tenant_salon.mcp.internal;

import net.samitkumar.multi_tenant_salon.salon.SalonOpeningDay;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static net.samitkumar.multi_tenant_salon.mcp.internal.SalonMcpSupport.nullableMap;

/**
 * Shapes a salon's resolved opening calendar ({@link SalonOpeningDay}) into what the apps render:
 * today's open/closed status with the next opening, a dated week of hours, and the upcoming
 * holidays and closures. Times are compared on the server clock — the same clock booking uses.
 */
final class SalonMcpOpening {
    /** How far ahead the next opening is searched for (covers long holiday closures). */
    static final int NEXT_OPEN_SEARCH_DAYS = 45;
    /** How far ahead upcoming holidays and closures are listed. */
    static final int UPCOMING_CLOSURE_DAYS = 60;

    private SalonMcpOpening() {}

    /**
     * Today's status: {@code OPEN_NOW}, {@code OPENS_LATER}, {@code CLOSED_FOR_TODAY} (past closing
     * time), {@code CLOSED_TODAY} (holiday, closure or weekly day off — with {@code reason}) or
     * {@code HOURS_NOT_SET}. Every status but OPEN_NOW and HOURS_NOT_SET carries {@code nextOpen}
     * when one exists within the search window.
     */
    static Map<String, Object> today(List<SalonOpeningDay> days, LocalTime now) {
        if (days == null || days.isEmpty()) return null;
        SalonOpeningDay today = days.getFirst();
        if (today.status() == SalonOpeningDay.Status.HOURS_NOT_SET) {
            return nullableMap("date", today.date().toString(), "status", "HOURS_NOT_SET");
        }
        if (today.status() == SalonOpeningDay.Status.OPEN) {
            LocalTime open = time(today.openTime());
            LocalTime close = time(today.closeTime());
            if (open != null && now.isBefore(open)) {
                return nullableMap("date", today.date().toString(), "status", "OPENS_LATER",
                        "openTime", today.openTime(), "closeTime", today.closeTime(),
                        "nextOpen", opening(today));
            }
            if (close == null || now.isBefore(close)) {
                return nullableMap("date", today.date().toString(), "status", "OPEN_NOW",
                        "openTime", today.openTime(), "closeTime", today.closeTime());
            }
            return nullableMap("date", today.date().toString(), "status", "CLOSED_FOR_TODAY",
                    "openTime", today.openTime(), "closeTime", today.closeTime(),
                    "nextOpen", nextOpen(days));
        }
        return nullableMap("date", today.date().toString(), "status", "CLOSED_TODAY",
                "closedBy", today.status().name(), "reason", today.reason(),
                "nextOpen", nextOpen(days));
    }

    /** One entry per date — the hours list the apps show instead of the bare weekly template. */
    static List<Map<String, Object>> week(List<SalonOpeningDay> days, int count) {
        return days.stream().limit(count).map(SalonMcpOpening::dayMap).toList();
    }

    /**
     * Holidays and one-off closures (not the weekly days off) in the given days, with consecutive
     * dates of the same closure merged into one {@code from}–{@code to} range.
     */
    static List<Map<String, Object>> upcomingClosures(List<SalonOpeningDay> days) {
        var ranges = new ArrayList<Map<String, Object>>();
        SalonOpeningDay start = null;
        SalonOpeningDay last = null;
        for (SalonOpeningDay day : days) {
            boolean special = day.status() == SalonOpeningDay.Status.CLOSED_HOLIDAY
                    || day.status() == SalonOpeningDay.Status.CLOSED_SPECIAL;
            boolean continues = special && last != null && last.status() == day.status()
                    && last.date().plusDays(1).equals(day.date()) && same(last.reason(), day.reason());
            if (!continues && start != null) {
                ranges.add(range(start, last));
                start = null;
            }
            if (special && start == null) start = day;
            last = special ? day : null;
        }
        if (start != null) ranges.add(range(start, last));
        return ranges;
    }

    static Map<String, Object> dayMap(SalonOpeningDay day) {
        return nullableMap("date", day.date().toString(), "weekday", day.weekday().name(),
                "status", day.status().name(), "openTime", day.openTime(), "closeTime", day.closeTime(),
                "reason", day.reason());
    }

    private static Map<String, Object> range(SalonOpeningDay from, SalonOpeningDay to) {
        return nullableMap("name", from.reason(), "kind", from.status() == SalonOpeningDay.Status.CLOSED_HOLIDAY ? "HOLIDAY" : "CLOSURE",
                "from", from.date().toString(), "to", to.date().toString());
    }

    private static Map<String, Object> nextOpen(List<SalonOpeningDay> days) {
        return days.stream().skip(1).filter(d -> d.status() == SalonOpeningDay.Status.OPEN)
                .findFirst().map(SalonMcpOpening::opening).orElse(null);
    }

    private static Map<String, Object> opening(SalonOpeningDay day) {
        return nullableMap("date", day.date().toString(), "weekday", day.weekday().name(),
                "openTime", day.openTime(), "closeTime", day.closeTime());
    }

    static LocalDate horizon(LocalDate today) {
        return today.plusDays(Math.max(NEXT_OPEN_SEARCH_DAYS, UPCOMING_CLOSURE_DAYS) - 1L);
    }

    private static LocalTime time(String text) {
        if (text == null || text.isBlank()) return null;
        try {
            return LocalTime.parse(text.strip());
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static boolean same(String a, String b) {
        return a == null ? b == null : a.equals(b);
    }
}
