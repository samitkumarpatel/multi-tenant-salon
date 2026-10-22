package net.samitkumar.multi_tenant_salon.membership;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One payment for one billing period — the first (with any sign-up fee) or a renewal. A {@code CARD}
 * payment is a Stripe Checkout whose reference is this id, like a shop order's or a till sale's;
 * {@code CASH}/{@code OTHER} are taken at the salon desk and recorded as paid on the spot. Only a
 * {@code PENDING} row ever changes, once, to {@code PAID} or {@code FAILED}.
 */
@Table("membership_payment")
public record MembershipPayment(
        @Id Long id,
        Long subscriptionId,
        UUID salonId,
        Kind kind,
        Status status,
        Method method,
        BigDecimal amount,
        String currency,
        String checkoutSessionId,
        Instant periodStart,
        Instant periodEnd,
        Instant paidAt,
        Instant createdAt
) {
    public enum Kind { SIGNUP, RENEWAL }

    public enum Status { PENDING, PAID, FAILED }

    /** Same choices as the till: {@code CARD} goes through Stripe Checkout. */
    public enum Method { CARD, CASH, OTHER }

    public MembershipPayment {
        if (method == null) method = Method.CARD;
    }
}
