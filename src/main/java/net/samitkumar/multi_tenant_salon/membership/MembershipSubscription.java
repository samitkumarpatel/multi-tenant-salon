package net.samitkumar.multi_tenant_salon.membership;

import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One member's membership of a plan. Paid the way the shop and till are: every billing period is a
 * one-time Stripe Checkout on the salon's connected account ({@link MembershipPayment}) that pushes
 * {@code currentPeriodEnd} forward. Before it runs out the member is emailed a renewal link carrying
 * {@code renewalToken}. Inserted once at checkout; later changes are conditional {@code UPDATE}s so
 * webhook redeliveries and the expiry job can't clobber each other. {@code memberCode} is what the
 * member's QR code encodes and what the salon checks at the desk.
 */
@Table("membership_subscription")
@Builder(toBuilder = true)
public record MembershipSubscription(
        @Id Long id,
        UUID salonId,
        Long planId,
        String planName,
        String memberCode,
        String renewalToken,
        String customerName,
        String customerEmail,
        String customerPhone,
        Status status,
        BigDecimal price,
        String currency,
        BillingInterval billingInterval,
        BigDecimal signupFee,
        Source source,
        Instant startedAt,
        Instant currentPeriodEnd,
        boolean cancelAtPeriodEnd,
        Instant cancelledAt,
        String cancelReason,
        Instant endedAt,
        Instant renewalReminderFor,
        MembershipPayment.Status lastPaymentStatus,
        Instant lastPaymentAt,
        BigDecimal lastPaymentAmount,
        Instant createdAt
) {
    public enum Status {
        /** First checkout started, Stripe hasn't confirmed payment yet. */
        PENDING_PAYMENT,
        /** Paid through {@code currentPeriodEnd}. */
        ACTIVE,
        /** The paid period ran out without a renewal; the member can still renew from their link. */
        EXPIRED,
        /** Ended by the salon (now, or at the end of the paid period). */
        CANCELLED,
        /** The first checkout was abandoned or its payment failed; never became a membership. */
        INCOMPLETE;

        /** A member right now — what holds a place on a capped plan and passes check-in. */
        public boolean current() { return this == ACTIVE; }

        /** Statuses whose member may pay for another period. */
        public boolean renewable() { return this == ACTIVE || this == EXPIRED; }
    }

    /** Where the membership came from. Self-service changes from the member arrive later. */
    public enum Source { ONLINE, ADMIN }

    public MembershipSubscription {
        if (status == null) status = Status.PENDING_PAYMENT;
        if (source == null) source = Source.ONLINE;
    }
}
