package net.samitkumar.multi_tenant_salon.booking.internal;

import net.samitkumar.multi_tenant_salon.booking.internal.BookingPaymentLinks.FollowUp;
import net.samitkumar.multi_tenant_salon.booking.internal.BookingPaymentLinks.Link;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Set;

/**
 * Follow-up on the payment links the salon has sent: what is outstanding, each appointment's history, and sending a
 * link again. Open to the owner and, while "Appointment management" is on, to the desk ({@code SalonDeskAccess}).
 */
@RestController
@RequestMapping("/api/salon-admin/{salonId}/booking")
class BookingPaymentLinkController {
    private static final Set<String> FILTERS = Set.of("OPEN", "EXPIRED", "PAID", "ALL");

    private final BookingPaymentLinks links;
    private final BookingService bookings;
    private final SalonApi salonApi;
    private final SalonServiceApi services;

    BookingPaymentLinkController(BookingPaymentLinks links, BookingService bookings, SalonApi salonApi, SalonServiceApi services) {
        this.links = links;
        this.bookings = bookings;
        this.salonApi = salonApi;
        this.services = services;
    }

    /** The latest link of each appointment, newest first: {@code ?status=OPEN|EXPIRED|PAID|ALL} (default {@code ALL}). */
    @GetMapping("/payment-links")
    List<FollowUp> followUps(@PathVariable String salonId, @RequestParam(defaultValue = "ALL") String status,
                             @RequestParam(defaultValue = "200") int limit) {
        var filter = status.toUpperCase(java.util.Locale.ROOT);
        if (!FILTERS.contains(filter)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status must be OPEN, EXPIRED, PAID or ALL");
        return links.followUps(salonApi.resolveId(salonId), filter, limit);
    }

    /** Every link sent for one appointment, newest first. */
    @GetMapping("/{bookingId}/payment-links")
    List<Link> forBooking(@PathVariable String salonId, @PathVariable Long bookingId) {
        var id = salonApi.resolveId(salonId);
        bookings.findById(id, bookingId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        return links.forBooking(id, bookingId);
    }

    /** Emails the same link to the customer again. Only while it is open; an expired one needs a new link. */
    @PostMapping("/{bookingId}/payment-links/{linkId}/resend")
    Link resend(@PathVariable String salonId, @PathVariable Long bookingId, @PathVariable Long linkId) {
        var id = salonApi.resolveId(salonId);
        var booking = bookings.findById(id, bookingId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        var link = links.find(id, bookingId, linkId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment link not found"));
        if (!"OPEN".equals(link.status())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "PAID".equals(link.status()) ? "This link has already been paid"
                    : "This link is no longer open — create a new payment link");
        }
        if (booking.customerEmail() == null || booking.customerEmail().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This customer has no email address — copy the link instead");
        }
        if (link.lastEmailedAt() != null && link.lastEmailedAt().isAfter(Instant.now().minus(BookingPaymentLinks.MIN_RESEND_GAP))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This link was just emailed — give it a minute");
        }
        var serviceName = services.findByIdAndSalonId(booking.serviceId(), id).map(s -> s.name()).orElse("Appointment");
        bookings.sendPaymentLink(booking, serviceName, link.amount(), link.currency(), link.url());
        links.markEmailed(id, linkId, booking.customerEmail());
        return links.find(id, bookingId, linkId).orElse(link);
    }
}
