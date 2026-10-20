package net.samitkumar.multi_tenant_salon.booking.internal;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;

import static org.assertj.core.api.Assertions.assertThat;

/** Slots that have already started are never offered or customer-bookable. */
class BookingPastSlotTest {

    @Test
    void anyTimeOnAnEarlierDayHasPassedAndAnyTimeOnALaterDayHasNot() {
        assertThat(BookingService.startsInPast(LocalDate.now().minusDays(1), LocalTime.MAX)).isTrue();
        assertThat(BookingService.startsInPast(LocalDate.now().plusDays(1), LocalTime.MIDNIGHT)).isFalse();
    }

    @Test
    void todayOnlyTheTimesBeforeNowHavePassed() {
        LocalTime now = LocalTime.now();
        // Skip the one-minute window around midnight, where "earlier today" doesn't exist.
        if (now.isBefore(LocalTime.of(0, 1)) || now.isAfter(LocalTime.of(23, 58))) return;
        assertThat(BookingService.startsInPast(LocalDate.now(), now.minusMinutes(1))).isTrue();
        assertThat(BookingService.startsInPast(LocalDate.now(), now.plusMinutes(1))).isFalse();
    }
}
