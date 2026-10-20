package net.samitkumar.multi_tenant_salon.salon.internal;

import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonClosure;
import net.samitkumar.multi_tenant_salon.salon.SalonHoliday;
import net.samitkumar.multi_tenant_salon.salon.SalonOpeningDay.Status;
import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Weekly hours with holidays and closures applied, date by date. */
class OpeningCalendarTest {

    private static final UUID SALON = UUID.randomUUID();
    /** Monday–Saturday 09:00–18:00, Sunday off. */
    private static final List<Salon.OperatingHours> HOURS = Arrays.stream(DayOfWeek.values())
            .map(d -> new Salon.OperatingHours(d, "09:00", "18:00", d == DayOfWeek.SUNDAY))
            .toList();
    private static final LocalDate MONDAY = LocalDate.of(2031, 3, 3).with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));

    @Test
    void openDaysCarryTheirHoursAndWeeklyDaysOffSayWhichWeekday() {
        var open = OpeningCalendar.resolve(HOURS, List.of(), List.of(), MONDAY);
        var sunday = OpeningCalendar.resolve(HOURS, List.of(), List.of(), MONDAY.plusDays(6));

        assertThat(open.status()).isEqualTo(Status.OPEN);
        assertThat(open.openTime()).isEqualTo("09:00");
        assertThat(open.closeTime()).isEqualTo("18:00");
        assertThat(sunday.status()).isEqualTo(Status.CLOSED_WEEKLY);
        assertThat(sunday.reason()).isEqualTo("Closed on Sundays");
        assertThat(sunday.closed()).isTrue();
    }

    @Test
    void aWeekdayWithNoRowIsClosedAndASalonWithoutHoursIsUnknown() {
        var noSaturday = HOURS.stream().filter(h -> h.day() != DayOfWeek.SATURDAY).toList();

        assertThat(OpeningCalendar.resolve(noSaturday, List.of(), List.of(), MONDAY.plusDays(5)).status())
                .isEqualTo(Status.CLOSED_WEEKLY);
        var unknown = OpeningCalendar.resolve(List.of(), List.of(), List.of(), MONDAY);
        assertThat(unknown.status()).isEqualTo(Status.HOURS_NOT_SET);
        assertThat(unknown.closed()).isFalse();
    }

    @Test
    void closuresWinOverOpenWeekdaysAndAreTaggedHolidayOrSpecial() {
        var closures = List.of(
                new SalonClosure(1L, SALON, MONDAY, MONDAY, "Christmas Day", 9L),
                new SalonClosure(2L, SALON, MONDAY.plusDays(1), MONDAY.plusDays(2), "Renovation", null),
                new SalonClosure(3L, SALON, MONDAY.plusDays(3), MONDAY.plusDays(3), " ", null));

        var days = OpeningCalendar.resolve(HOURS, closures, List.of(), MONDAY, MONDAY.plusDays(4));

        assertThat(days).extracting(d -> d.status()).containsExactly(
                Status.CLOSED_HOLIDAY, Status.CLOSED_SPECIAL, Status.CLOSED_SPECIAL, Status.CLOSED_SPECIAL, Status.OPEN);
        assertThat(days).extracting(d -> d.reason()).containsExactly(
                "Christmas Day", "Renovation", "Renovation", "Closed for the day", null);
    }

    @Test
    void aRecurringHolidayWithoutClosureRowsStillClosesTheSalonEvenAcrossNewYear() {
        var winterBreak = holiday("Winter break", 12, 24, 1, 2, null);

        assertThat(OpeningCalendar.resolve(HOURS, List.of(), List.of(winterBreak), LocalDate.of(2040, 12, 23)).status())
                .isNotEqualTo(Status.CLOSED_HOLIDAY);
        assertThat(OpeningCalendar.resolve(HOURS, List.of(), List.of(winterBreak), LocalDate.of(2040, 12, 24)).reason())
                .isEqualTo("Winter break");
        assertThat(OpeningCalendar.resolve(HOURS, List.of(), List.of(winterBreak), LocalDate.of(2041, 1, 2)).status())
                .isEqualTo(Status.CLOSED_HOLIDAY);
        assertThat(OpeningCalendar.resolve(HOURS, List.of(), List.of(winterBreak), LocalDate.of(2041, 1, 3)).status())
                .isNotEqualTo(Status.CLOSED_HOLIDAY);
    }

    @Test
    void aYearSpecificHolidayOnlyAppliesThatYearAndLeapDaysAreSkippedOtherwise() {
        var oneOff = holiday("Jubilee", 6, 2, null, null, 2032);
        var leapDay = holiday("Leap day", 2, 29, null, null, null);

        assertThat(OpeningCalendar.covers(oneOff, LocalDate.of(2032, 6, 2))).isTrue();
        assertThat(OpeningCalendar.covers(oneOff, LocalDate.of(2033, 6, 2))).isFalse();
        assertThat(OpeningCalendar.covers(leapDay, LocalDate.of(2032, 2, 29))).isTrue();
        assertThat(OpeningCalendar.covers(leapDay, LocalDate.of(2033, 2, 28))).isFalse();
        assertThat(OpeningCalendar.covers(leapDay, LocalDate.of(2033, 3, 1))).isFalse();
    }

    private static SalonHoliday holiday(String name, int month, int day, Integer endMonth, Integer endDay, Integer year) {
        return new SalonHoliday(1L, SALON, name, month, day, endMonth, endDay, year, null);
    }
}
