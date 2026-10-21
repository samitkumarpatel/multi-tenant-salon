package net.samitkumar.multi_tenant_salon.membership;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneOffset;

/** How often a membership renews and is charged. */
public enum BillingInterval {
    MONTHLY(1), QUARTERLY(3), YEARLY(12);

    private final int months;

    BillingInterval(int months) { this.months = months; }

    public int months() { return months; }

    /** The price expressed per month — used to sum monthly recurring revenue across intervals. */
    public BigDecimal monthly(BigDecimal price) {
        return price == null ? BigDecimal.ZERO : price.divide(BigDecimal.valueOf(months), 2, RoundingMode.HALF_UP);
    }

    /** One billing period after {@code from}. */
    public Instant after(Instant from) {
        return from.atOffset(ZoneOffset.UTC).plusMonths(months).toInstant();
    }
}
