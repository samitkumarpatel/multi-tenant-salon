package net.samitkumar.multi_tenant_salon.dashboard.internal;

import org.springframework.modulith.events.ApplicationModuleListener;
import net.samitkumar.multi_tenant_salon.payments.StripePaymentEvent;
import org.springframework.stereotype.Component;

@Component
class DashboardStripePaymentListener {
    private final DashboardManager dashboard;
    DashboardStripePaymentListener(DashboardManager dashboard) { this.dashboard = dashboard; }

    /** Delivered (and retried on failure) by Spring Modulith; only {@code PENDING} sales move, so redelivery is harmless. */
    @ApplicationModuleListener
    void handle(StripePaymentEvent event) {
        if (!"POS".equals(event.paymentArea())) return;
        try {
            dashboard.recordStripePayment(event.salonId(), Long.parseLong(event.reference()),
                    event.checkoutSessionId(), event.succeeded());
        } catch (NumberFormatException ignored) {
            // Ignore malformed/foreign references; webhook delivery must remain idempotent.
        }
    }
}
