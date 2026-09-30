package net.samitkumar.multi_tenant_salon.dashboard.internal;

import net.samitkumar.multi_tenant_salon.payments.StripePaymentEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
class DashboardStripePaymentListener {
    private final DashboardManager dashboard;
    DashboardStripePaymentListener(DashboardManager dashboard) { this.dashboard = dashboard; }

    @EventListener
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
