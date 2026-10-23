package net.samitkumar.multi_tenant_salon.membership;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * What other modules may ask the membership module. The salon desk's end-of-day report needs the money
 * taken for memberships — a cash membership sold at the counter never touches the till's own sales —
 * without reaching into membership's tables.
 */
public interface MembershipApi {

    /** Membership payments settled in {@code [from, to)}, by currency and how they were paid. */
    List<Takings> takings(UUID salonId, Instant from, Instant to);

    /** Money given back on membership payments in {@code [from, to)}, by currency and how it was paid. */
    List<Takings> refunds(UUID salonId, Instant from, Instant to);

    /** @param method {@code CARD}, {@code CASH} or {@code OTHER} — how the original payment was made */
    record Takings(String currency, String method, long count, BigDecimal total) {}
}
