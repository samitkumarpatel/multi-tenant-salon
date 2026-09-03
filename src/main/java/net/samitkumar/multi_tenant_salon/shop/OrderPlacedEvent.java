package net.samitkumar.multi_tenant_salon.shop;

import java.math.BigDecimal;
import java.util.UUID;

/** Published when a customer completes checkout — drives the customer confirmation + admin notice. */
public record OrderPlacedEvent(
        Long orderId,
        UUID salonId,
        String orderNumber,
        String customerName,
        String customerEmail,
        String customerPhone,
        int itemCount,
        BigDecimal subtotal,
        String currency,
        String salonName,
        String salonPhone,
        String salonEmail
) {}
