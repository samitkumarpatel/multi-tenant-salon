package net.samitkumar.multi_tenant_salon.booking.internal;

import org.springframework.modulith.events.ApplicationModuleListener;
import net.samitkumar.multi_tenant_salon.payments.StripePaymentEvent;
import org.springframework.stereotype.Component;

@Component
class BookingStripePaymentListener {
    private final BookingService bookings;
    private final BookingPaymentLinks links;
    BookingStripePaymentListener(BookingService bookings, BookingPaymentLinks links) { this.bookings = bookings; this.links = links; }

    /** Delivered (and retried on failure) by Spring Modulith; only {@code PENDING} payments move, so redelivery is harmless. */
    @ApplicationModuleListener
    void handle(StripePaymentEvent event) {
        if (!"BOOKING".equals(event.paymentArea())) return;
        try {
            long bookingId = Long.parseLong(event.reference());
            // Keep the salon's record of the link up to date. A newer link replaces an older one, so an older link
            // expiring (we expire it ourselves) must not mark the appointment's payment as failed while the new one is open.
            var settlement = links.settle(event.salonId(), event.checkoutSessionId(), event.succeeded());
            if (!event.succeeded() && settlement.known() && !settlement.current()) return;
            bookings.recordStripePayment(event.salonId(), bookingId, event.checkoutSessionId(), event.succeeded());
        } catch (NumberFormatException ignored) {
            // Malformed metadata can never succeed; completing the publication stops further retries.
        }
    }
}
