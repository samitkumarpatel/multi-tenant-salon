package net.samitkumar.multi_tenant_salon.shop;

import java.time.Instant;
import java.util.UUID;

/**
 * Acknowledgement event: the notification module publishes this after it has dispatched a
 * customer-facing email about an order (in response to {@link OrderPlacedEvent} /
 * {@link OrderStatusChangedEvent} / {@link OrderLineActivityAddedEvent}).
 *
 * <p>It lives in the {@code shop} package — the module that reacts to it — so the round-trip
 * stays event-driven without creating a {@code shop → notification} dependency cycle
 * ({@code notification} already depends on {@code shop} for the events above). The shop module's
 * own listener appends it to the order's activity timeline as a {@code CUSTOMER_NOTIFIED} entry.
 */
public record OrderCustomerNotifiedEvent(
        UUID salonId,
        String orderNumber,
        String channel,
        String recipient,
        String subject,
        String body,
        String status,
        Instant sentAt
) {
    public static final String CHANNEL_EMAIL = "EMAIL";
}
