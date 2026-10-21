package net.samitkumar.multi_tenant_salon.membership.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.membership.MembershipCustomerNotifiedEvent;
import net.samitkumar.multi_tenant_salon.payments.StripePaymentEvent;
import org.springframework.context.event.EventListener;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@Slf4j
class MembershipEventListeners {
    private final MembershipManager memberships;

    MembershipEventListeners(MembershipManager memberships) { this.memberships = memberships; }

    /** Same as the shop's, booking's and till's payment listeners — the reference is a membership payment id. */
    @EventListener
    void onStripePayment(StripePaymentEvent event) {
        if (!MembershipManager.PAYMENT_AREA.equals(event.paymentArea())) return;
        try {
            memberships.recordStripePayment(event.salonId(), Long.parseLong(event.reference()),
                    event.checkoutSessionId(), event.succeeded());
        } catch (NumberFormatException ignored) {
            // Ignore malformed metadata; Stripe may retry delivery and valid events remain idempotent.
        }
    }

    /** The notification module's acknowledgement — recorded on the member's timeline. */
    @ApplicationModuleListener
    void onCustomerNotified(MembershipCustomerNotifiedEvent event) {
        log.info("[membership] Member notified for subscription {} ({}, {})", event.subscriptionId(), event.channel(), event.status());
        memberships.recordCustomerNotification(event);
    }
}
