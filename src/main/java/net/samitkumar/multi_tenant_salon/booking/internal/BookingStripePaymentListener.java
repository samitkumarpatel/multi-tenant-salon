package net.samitkumar.multi_tenant_salon.booking.internal;

import org.springframework.modulith.events.ApplicationModuleListener;
import net.samitkumar.multi_tenant_salon.payments.StripePaymentEvent;
import org.springframework.stereotype.Component;

@Component
class BookingStripePaymentListener {
    private final BookingService bookings;
    BookingStripePaymentListener(BookingService bookings) { this.bookings = bookings; }

    /** Delivered (and retried on failure) by Spring Modulith; only {@code PENDING} payments move, so redelivery is harmless. */
    @ApplicationModuleListener
    void handle(StripePaymentEvent event) {
        if (!"BOOKING".equals(event.paymentArea())) return;
        try {
            bookings.recordStripePayment(event.salonId(), Long.parseLong(event.reference()), event.checkoutSessionId(), event.succeeded());
        } catch (NumberFormatException ignored) {
            // Malformed metadata can never succeed; completing the publication stops further retries.
        }
    }
}
