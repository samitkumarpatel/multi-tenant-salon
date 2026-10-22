package net.samitkumar.multi_tenant_salon.shop.internal;

import org.springframework.modulith.events.ApplicationModuleListener;
import net.samitkumar.multi_tenant_salon.payments.StripePaymentEvent;
import org.springframework.stereotype.Component;

@Component
class ShopStripePaymentListener {
    private final ShopManager shop;
    ShopStripePaymentListener(ShopManager shop) { this.shop = shop; }

    /** Delivered (and retried on failure) by Spring Modulith; only {@code PENDING} orders move, so redelivery is harmless. */
    @ApplicationModuleListener
    void handle(StripePaymentEvent event) {
        if (!"SHOP".equals(event.paymentArea())) return;
        try {
            shop.recordStripePayment(event.salonId(), Long.parseLong(event.reference()), event.checkoutSessionId(), event.succeeded());
        } catch (NumberFormatException ignored) {
            // Malformed metadata can never succeed; completing the publication stops further retries.
        }
    }
}
