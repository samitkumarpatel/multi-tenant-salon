package net.samitkumar.multi_tenant_salon.membership;

import java.time.Instant;
import java.util.UUID;

/**
 * Acknowledgement event: the notification module publishes this after emailing a member about
 * their membership. It lives in the {@code membership} package — the module that reacts to it — so
 * the round-trip stays event-driven without a {@code membership → notification} dependency cycle;
 * the membership module records it on the subscription's timeline.
 */
public record MembershipCustomerNotifiedEvent(
        UUID salonId,
        Long subscriptionId,
        String channel,
        String recipient,
        String subject,
        String status,
        Instant sentAt
) {
    public static final String CHANNEL_EMAIL = "EMAIL";
}
