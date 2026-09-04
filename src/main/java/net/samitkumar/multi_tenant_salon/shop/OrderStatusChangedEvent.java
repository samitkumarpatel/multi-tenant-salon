package net.samitkumar.multi_tenant_salon.shop;

import java.util.UUID;

/** Published when the salon moves an order to a new {@link OrderStatus} — customer gets notified. */
public record OrderStatusChangedEvent(
        Long orderId,
        UUID salonId,
        String orderNumber,
        OrderStatus newStatus,
        String customerName,
        String customerEmail,
        String salonName,
        String salonPhone,
        String salonEmail,
        CommunicationPreference communicationPreference
) {}
