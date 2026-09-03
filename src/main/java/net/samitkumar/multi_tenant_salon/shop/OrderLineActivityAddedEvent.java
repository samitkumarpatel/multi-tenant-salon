package net.samitkumar.multi_tenant_salon.shop;

import java.util.UUID;

/**
 * Published when an activity is appended to an order line. Only the admin's "Notify User" action
 * ({@link OrderLineActivityType#USER_NOTIFIED}) currently raises this — the notification module
 * turns it into a (dummy) customer email. Plain notes do not emit an event.
 */
public record OrderLineActivityAddedEvent(
        Long orderId,
        UUID salonId,
        String orderNumber,
        Long orderLineId,
        String productName,
        OrderLineActivityType type,
        String message,
        String customerName,
        String customerEmail,
        String salonName,
        String salonEmail
) {}
