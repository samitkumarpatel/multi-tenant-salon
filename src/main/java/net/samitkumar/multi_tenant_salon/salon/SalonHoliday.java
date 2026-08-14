package net.samitkumar.multi_tenant_salon.salon;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;

import java.time.Instant;
import java.util.UUID;

/**
 * A named holiday for a salon. Blocks bookings on the matching date(s).
 * When {@code year} is null the holiday repeats every year.
 * When {@code endMonth}/{@code endDay} are null the holiday covers a single day.
 * When {@code endMonth}/{@code endDay} are set the holiday covers a date range
 * (inclusive on both ends; ranges that span a year boundary, e.g. Dec 24–Jan 2, are supported).
 */
public record SalonHoliday(
        @Id Long id,
        UUID salonId,
        String name,
        @Column("holiday_month") int month,
        @Column("holiday_day")   int day,
        @Column("end_month")     Integer endMonth,
        @Column("end_day")       Integer endDay,
        Integer year,
        Instant createdAt
) {}
