package net.samitkumar.multi_tenant_salon.membership;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

/** One entry on a membership's timeline. Insert-only. */
@Table("membership_activity")
public record MembershipActivity(
        @Id Long id,
        Long subscriptionId,
        UUID salonId,
        Type type,
        String message,
        String actor,
        Instant createdAt
) {
    public enum Type {
        CHECKOUT_STARTED, CHECKOUT_FAILED, ACTIVATED, RENEWAL_STARTED, RENEWED, PAYMENT_FAILED, EXPIRED,
        CANCELLATION_SCHEDULED, CANCELLATION_UNDONE, CANCELLED, CUSTOMER_NOTIFIED, NOTE, CONTACT_UPDATED, REFUNDED
    }
}
