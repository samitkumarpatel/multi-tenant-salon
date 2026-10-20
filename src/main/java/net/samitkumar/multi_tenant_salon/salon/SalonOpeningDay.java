package net.samitkumar.multi_tenant_salon.salon;

import java.time.DayOfWeek;
import java.time.LocalDate;

/**
 * What a salon's door looks like on one real calendar date: the weekly hours with holidays and
 * one-off closures applied. {@code openTime}/{@code closeTime} are set only when {@link Status#OPEN};
 * {@code reason} is set for every closed status (the holiday or closure name, or "Closed on Sundays").
 */
public record SalonOpeningDay(
        LocalDate date,
        DayOfWeek weekday,
        Status status,
        String openTime,
        String closeTime,
        String reason
) {
    public enum Status {
        /** Open with the weekly hours for that weekday. */
        OPEN,
        /** The weekday is a regular day off. */
        CLOSED_WEEKLY,
        /** A named holiday (recurring or year-specific) covers the date. */
        CLOSED_HOLIDAY,
        /** A one-off closure covers the date. */
        CLOSED_SPECIAL,
        /** The salon has not published weekly hours, so nothing can be said about the date. */
        HOURS_NOT_SET
    }

    public boolean closed() {
        return status == Status.CLOSED_WEEKLY || status == Status.CLOSED_HOLIDAY || status == Status.CLOSED_SPECIAL;
    }
}
