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
        Instant createdAt,
        /** Running total given back to the member, so repeated partial refunds accumulate. */
        BigDecimal refundedAmount,
        Instant refundedAt,
        String refundReason
) {
    /** A fresh, unpaid payment for one period — nothing settled and nothing refunded yet. */
    public static MembershipPayment pending(Long subscriptionId, UUID salonId, Kind kind, Method method,
                                            BigDecimal amount, String currency, Instant createdAt) {
        return new MembershipPayment(null, subscriptionId, salonId, kind, Status.PENDING, method, amount, currency,
                null, null, null, null, createdAt, null, null, null);
    }

    /** How much of this payment can still be given back. */
    public BigDecimal refundable() {
        if (status != Status.PAID) return BigDecimal.ZERO;
        var back = refundedAmount == null ? BigDecimal.ZERO : refundedAmount;
        var left = amount.subtract(back);
        return left.signum() > 0 ? left : BigDecimal.ZERO;
    }

    public enum Kind { SIGNUP, RENEWAL }

    public enum Status { PENDING, PAID, FAILED }

    /** Same choices as the till: {@code CARD} goes through Stripe Checkout. */
    public enum Method { CARD, CASH, OTHER }

    public MembershipPayment {
        if (method == null) method = Method.CARD;
    }
}
