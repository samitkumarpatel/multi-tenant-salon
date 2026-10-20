package net.samitkumar.multi_tenant_salon.mcp.internal;

import net.samitkumar.multi_tenant_salon.salon.SalonOpeningDay;
import net.samitkumar.multi_tenant_salon.salon.SalonOpeningDay.Status;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Today's status, the dated week and upcoming closures the salon apps render. */
@SuppressWarnings("unchecked")
class SalonMcpOpeningTest {

    private static final LocalDate DAY = LocalDate.of(2031, 3, 3);

    @Test
    void openDaySaysOpenNowBeforeClosingAndOpensLaterBeforeOpening() {
        var days = List.of(open(DAY), open(DAY.plusDays(1)));

        assertThat(SalonMcpOpening.today(days, LocalTime.of(12, 0)))
                .containsEntry("status", "OPEN_NOW").containsEntry("closeTime", "18:00").doesNotContainKey("nextOpen");
        assertThat(SalonMcpOpening.today(days, LocalTime.of(8, 0)))
                .containsEntry("status", "OPENS_LATER")
                .containsEntry("nextOpen", Map.of("date", DAY.toString(), "weekday", DAY.getDayOfWeek().name(), "openTime", "09:00", "closeTime", "18:00"));
    }

    @Test
    void afterClosingTheNextOpeningSkipsHolidaysAndDaysOff() {
        var days = List.of(open(DAY), closed(DAY.plusDays(1), Status.CLOSED_HOLIDAY, "Easter Monday"),
                closed(DAY.plusDays(2), Status.CLOSED_WEEKLY, "Closed on Sundays"), open(DAY.plusDays(3)));

        var today = SalonMcpOpening.today(days, LocalTime.of(18, 30));

        assertThat(today).containsEntry("status", "CLOSED_FOR_TODAY");
        assertThat((Map<String, Object>) today.get("nextOpen")).containsEntry("date", DAY.plusDays(3).toString());
    }

    @Test
    void aHolidayTodayNamesItselfAndSaysWhenTheSalonReopens() {
        var days = List.of(closed(DAY, Status.CLOSED_HOLIDAY, "Christmas Day"), open(DAY.plusDays(1)));

        var today = SalonMcpOpening.today(days, LocalTime.of(12, 0));

        assertThat(today).containsEntry("status", "CLOSED_TODAY").containsEntry("closedBy", "CLOSED_HOLIDAY")
                .containsEntry("reason", "Christmas Day");
        assertThat((Map<String, Object>) today.get("nextOpen")).containsEntry("date", DAY.plusDays(1).toString());
    }

    @Test
    void noPublishedHoursAndNoCalendarAreReportedHonestly() {
        assertThat(SalonMcpOpening.today(List.of(new SalonOpeningDay(DAY, DAY.getDayOfWeek(), Status.HOURS_NOT_SET, null, null, null)), LocalTime.NOON))
                .containsEntry("status", "HOURS_NOT_SET");
        assertThat(SalonMcpOpening.today(List.of(), LocalTime.NOON)).isNull();
    }

    @Test
    void upcomingClosuresMergeConsecutiveDaysAndIgnoreWeeklyDaysOff() {
        var days = List.of(
                closed(DAY, Status.CLOSED_HOLIDAY, "Winter break"),
                closed(DAY.plusDays(1), Status.CLOSED_HOLIDAY, "Winter break"),
                closed(DAY.plusDays(2), Status.CLOSED_SPECIAL, "Staff training"),
                closed(DAY.plusDays(3), Status.CLOSED_WEEKLY, "Closed on Sundays"),
                open(DAY.plusDays(4)),
                closed(DAY.plusDays(5), Status.CLOSED_HOLIDAY, "Winter break"));

        assertThat(SalonMcpOpening.upcomingClosures(days)).containsExactly(
                Map.of("name", "Winter break", "kind", "HOLIDAY", "from", DAY.toString(), "to", DAY.plusDays(1).toString()),
                Map.of("name", "Staff training", "kind", "CLOSURE", "from", DAY.plusDays(2).toString(), "to", DAY.plusDays(2).toString()),
                Map.of("name", "Winter break", "kind", "HOLIDAY", "from", DAY.plusDays(5).toString(), "to", DAY.plusDays(5).toString()));
    }

    @Test
    void theWeekIsOneEntryPerRealDate() {
        var week = SalonMcpOpening.week(List.of(open(DAY), closed(DAY.plusDays(1), Status.CLOSED_HOLIDAY, "Easter Monday")), 7);

        assertThat(week).hasSize(2);
        assertThat(week.get(1)).containsEntry("status", "CLOSED_HOLIDAY").containsEntry("reason", "Easter Monday")
                .doesNotContainKey("openTime");
    }

    private static SalonOpeningDay open(LocalDate date) {
        return new SalonOpeningDay(date, date.getDayOfWeek(), Status.OPEN, "09:00", "18:00", null);
    }

    private static SalonOpeningDay closed(LocalDate date, Status status, String reason) {
        return new SalonOpeningDay(date, date.getDayOfWeek(), status, null, null, reason);
    }
}
