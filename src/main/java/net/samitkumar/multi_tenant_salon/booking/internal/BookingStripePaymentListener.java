package net.samitkumar.multi_tenant_salon.booking.internal;

import net.samitkumar.multi_tenant_salon.payments.StripePaymentEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
class BookingStripePaymentListener {
    private final BookingService bookings;
    BookingStripePaymentListener(BookingService bookings) { this.bookings = bookings; }

    @EventListener
    void handle(StripePaymentEvent event) {
        if (!"BOOKING".equals(event.paymentArea())) return;
        try {
            bookings.recordStripePayment(event.salonId(), Long.parseLong(event.reference()), event.checkoutSessionId(), event.succeeded());
        } catch (NumberFormatException ignored) {
            // Ignore malformed metadata; valid Stripe events can be retried safely.
        }
    }
}
