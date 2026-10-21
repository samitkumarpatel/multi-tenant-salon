package net.samitkumar.multi_tenant_salon.membership;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One Stripe Checkout for one billing period — the first (with any sign-up fee) or a renewal. Its id
 * is the checkout's payment reference, like a shop order's or a till sale's. Only a {@code PENDING}
 * row ever changes, once, to {@code PAID} or {@code FAILED}.
 */
@Table("membership_payment")
public record MembershipPayment(
        @Id Long id,
        Long subscriptionId,
        UUID salonId,
        Kind kind,
        Status status,
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
}
