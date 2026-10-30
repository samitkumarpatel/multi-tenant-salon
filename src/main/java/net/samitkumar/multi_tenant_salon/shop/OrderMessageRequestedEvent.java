package net.samitkumar.multi_tenant_salon.shop;

import java.util.UUID;

/** An order operation which needs a customer message, rather than just a log entry. */
public record OrderMessageRequestedEvent(UUID salonId, Long orderId, Long activityId, String orderNumber, String customerName,
        String customerEmail, String message, String salonName, boolean skipped) {}
