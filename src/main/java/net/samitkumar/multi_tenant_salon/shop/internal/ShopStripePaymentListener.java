package net.samitkumar.multi_tenant_salon.shop.internal;

import net.samitkumar.multi_tenant_salon.payments.StripePaymentEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
class ShopStripePaymentListener {
    private final ShopManager shop;
    ShopStripePaymentListener(ShopManager shop) { this.shop = shop; }

    @EventListener
    void handle(StripePaymentEvent event) {
        if (!"SHOP".equals(event.paymentArea())) return;
        try {
            shop.recordStripePayment(event.salonId(), Long.parseLong(event.reference()), event.checkoutSessionId(), event.succeeded());
        } catch (NumberFormatException ignored) {
            // Ignore malformed metadata; Stripe may retry delivery and valid events remain idempotent.
        }
    }
}
