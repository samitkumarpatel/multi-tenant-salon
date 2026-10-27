package net.samitkumar.multi_tenant_salon.booking.internal;

import net.samitkumar.multi_tenant_salon.booking.AvailableSlot;
import net.samitkumar.multi_tenant_salon.booking.Booking;
import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import net.samitkumar.multi_tenant_salon.booking.SalonAvailability;
import net.samitkumar.multi_tenant_salon.booking.StaffSchedule;
import net.samitkumar.multi_tenant_salon.payments.PaymentGateway;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@RestController
class BookingController {

    private final BookingService service;
    private final SalonApi salonApi;
    private final PaymentGateway stripe;
    private final SalonServiceApi services;
    private final BookingFeePolicies feePolicies;
    private final BookingPaymentLinks paymentLinks;

    /** {@code checkoutUrl} for a redirect checkout; {@code checkout} also covers the in-page payment form. */
    record BookingCheckout(Booking booking, String checkoutUrl, PaymentGateway.Checkout checkout) {}

    BookingController(BookingService service, SalonApi salonApi, PaymentGateway stripe, SalonServiceApi services,
                      BookingFeePolicies feePolicies, BookingPaymentLinks paymentLinks) {
        this.paymentLinks = paymentLinks;
        this.service = service;
        this.salonApi = salonApi;
        this.stripe = stripe;
        this.services = services;
        this.feePolicies = feePolicies;
    }

    record CreateBookingRequest(Long serviceId, Long staffId, String customerName,
                                String customerEmail, String customerPhone,
                                LocalDate appointmentDate, LocalTime startTime, String notes,
                                String returnUrl, Boolean inlineCheckout) {}

    record UpdateBookingRequest(LocalDate appointmentDate, LocalTime startTime, Long staffId, String notes) {}

    @GetMapping({"/api/salon/{salonId}/booking/slots", "/api/salon-admin/{salonId}/booking/slots"})
    List<AvailableSlot> getAvailableSlots(
            @PathVariable String salonId,
            @RequestParam Long serviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) Long staffId) {
        return service.findAvailableSlots(salonApi.resolveId(salonId), serviceId, date, staffId);
    }

    // Flexible range query behind the Gen-UI booking flow and the chat assistant's
    // findAvailableDates / checkAvailability tools — day statuses (OPEN / SALON_CLOSED /
    // STAFF_OFF / FULLY_BOOKED with a reason), optionally per stylist, optionally with slots.
    @GetMapping({"/api/salon/{salonId}/availability", "/api/salon-admin/{salonId}/availability"})
    SalonAvailability getAvailability(
            @PathVariable String salonId,
            @RequestParam(required = false) Long serviceId,
            @RequestParam(required = false) Long staffId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "DAY") SalonAvailability.Granularity granularity,
            @RequestParam(required = false) Integer limit) {
        return service.queryAvailability(salonApi.resolveId(salonId), serviceId, staffId, from, to, granularity, limit);
    }

    // Lets a booking UI grey out a calendar for a specific staff member (their days off, their
    // one-off unavailable dates) up front, instead of only discovering it's empty after the
    // visitor picks a date and calls getAvailableSlots.
    @GetMapping({"/api/salon/{salonId}/staff/{staffId}/schedule", "/api/salon-admin/{salonId}/staff/{staffId}/schedule"})
    StaffSchedule getStaffSchedule(@PathVariable String salonId, @PathVariable Long staffId) {
        return service.findStaffSchedule(salonApi.resolveId(salonId), staffId);
    }

    @GetMapping("/api/salon-admin/{salonId}/booking")
    List<Booking> listBookings(@PathVariable String salonId) {
        return service.findAll(salonApi.resolveId(salonId));
    }

    @PostMapping({"/api/salon/{salonId}/booking", "/api/salon-admin/{salonId}/booking"})
    ResponseEntity<?> createBooking(@PathVariable String salonId,
                                    @RequestBody CreateBookingRequest request,
                                    jakarta.servlet.http.HttpServletRequest httpRequest) {
        var id = salonApi.resolveId(salonId);
        boolean customerBooking = httpRequest.getRequestURI().startsWith("/api/salon/");
        var paymentConfig = stripe.bookingConfig(id);
        boolean paymentRequired = customerBooking && paymentConfig.enabled();
        if (paymentRequired) stripe.requireEnabled(id, "BOOKING");
        var hasEmail = request.customerEmail() != null && !request.customerEmail().isBlank();
        var hasPhone = request.customerPhone() != null && !request.customerPhone().isBlank();
        if (!hasEmail && !hasPhone) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Either email or phone number is required");
        }
        // Customers can only book times still ahead; the salon admin may record a walk-in after the fact.
        if (customerBooking && request.appointmentDate() != null && request.startTime() != null
                && BookingService.startsInPast(request.appointmentDate(), request.startTime())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That time has already passed — choose a later time.");
        }
        var booking = service.create(id, request.serviceId(), request.staffId(),
                request.customerName(), request.customerEmail(), request.customerPhone(),
                request.appointmentDate(), request.startTime(), request.notes(), paymentRequired);
        if (paymentRequired) {
            try {
                var serviceItem = services.findByIdAndSalonId(request.serviceId(), id)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));
                var amount = serviceItem.price();
                if (paymentConfig.paymentType() == net.samitkumar.multi_tenant_salon.payments.SalonPaymentSettings.BookingPaymentType.DEPOSIT) {
                    amount = amount.multiply(java.math.BigDecimal.valueOf(paymentConfig.depositPercent()))
                            .divide(java.math.BigDecimal.valueOf(100), 2, java.math.RoundingMode.HALF_UP);
                }
                var checkout = stripe.createCheckout(id, new PaymentGateway.CheckoutRequest("BOOKING", String.valueOf(booking.id()),
                        amount, serviceItem.currency() == null ? "USD" : serviceItem.currency(),
                        "Booking payment — " + serviceItem.name(), request.returnUrl(), request.customerEmail(),
                        Boolean.TRUE.equals(request.inlineCheckout())));
                return ResponseEntity.ok(new BookingCheckout(booking, checkout.url(), checkout));
            } catch (RuntimeException error) {
                service.delete(id, booking.id());
                throw error;
            }
        }
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(booking.id())
                .toUri();
        return ResponseEntity.created(location).body(booking);
    }

    @GetMapping("/api/salon-admin/{salonId}/booking/{bookingId}")
    ResponseEntity<Booking> getBooking(@PathVariable String salonId, @PathVariable Long bookingId) {
        return service.findById(salonApi.resolveId(salonId), bookingId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/salon-admin/{salonId}/booking/{bookingId}")
    ResponseEntity<Booking> reschedule(@PathVariable String salonId, @PathVariable Long bookingId,
                                       @RequestBody UpdateBookingRequest request) {
        return service.reschedule(salonApi.resolveId(salonId), bookingId, request.appointmentDate(),
                        request.startTime(), request.staffId(), request.notes())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/salon-admin/{salonId}/booking/{bookingId}")
    ResponseEntity<Void> deleteBooking(@PathVariable String salonId, @PathVariable Long bookingId) {
        service.delete(salonApi.resolveId(salonId), bookingId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/salon-admin/{salonId}/booking/{bookingId}/confirm")
    ResponseEntity<Booking> confirm(@PathVariable String salonId, @PathVariable Long bookingId) {
        return service.updateStatus(salonApi.resolveId(salonId), bookingId, BookingStatus.CONFIRMED)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/api/salon-admin/{salonId}/booking/{bookingId}/cancel")
    ResponseEntity<Booking> cancel(@PathVariable String salonId, @PathVariable Long bookingId) {
        return service.updateStatus(salonApi.resolveId(salonId), bookingId, BookingStatus.CANCELLED)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/api/salon-admin/{salonId}/booking/{bookingId}/complete")
    ResponseEntity<Booking> complete(@PathVariable String salonId, @PathVariable Long bookingId) {
        return service.updateStatus(salonApi.resolveId(salonId), bookingId, BookingStatus.COMPLETED)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** {@code amount} defaults to the service price; {@code sendEmail} mails the link to the customer as well. */
    record PaymentLinkRequest(java.math.BigDecimal amount, Boolean sendEmail, String returnUrl) {}

    record PaymentLinkResponse(Booking booking, String paymentUrl, java.math.BigDecimal amount, String currency, boolean emailed,
                               BookingPaymentLinks.Link link) {}

    /**
     * A one-time Stripe Checkout link for an unpaid appointment — the salon's way to collect from a customer who
     * did not show up. Always a redirect checkout, since the link is opened from an email or a message. The
     * appointment keeps its status; paying only settles the money.
     */
    @PostMapping("/api/salon-admin/{salonId}/booking/{bookingId}/payment-link")
    PaymentLinkResponse paymentLink(@PathVariable String salonId, @PathVariable Long bookingId,
                                    @RequestBody(required = false) PaymentLinkRequest request,
                                    @org.springframework.security.core.annotation.AuthenticationPrincipal(errorOnInvalidType = false) org.springframework.security.oauth2.jwt.Jwt jwt) {
        var id = salonApi.resolveId(salonId);
        var booking = service.findById(id, bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        // Deliberately no check of the Payments tab's "Online bookings" switch: that decides whether customers pay when
        // they book. Chasing a no-show is the salon's own call and only needs a Stripe account that can take charges.
        var serviceItem = services.findByIdAndSalonId(booking.serviceId(), id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));
        // No amount given: a no-show is charged the salon's no-show fee (the whole price when it has none), anything else the price.
        var fee = booking.status() == BookingStatus.NO_SHOW ? feePolicies.get(id).noShowFee(serviceItem.price()) : java.math.BigDecimal.ZERO;
        var amount = request != null && request.amount() != null ? request.amount()
                : fee.signum() > 0 ? fee : serviceItem.price();
        if (amount == null || amount.signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A positive amount is required");
        }
        var emailRequested = request != null && Boolean.TRUE.equals(request.sendEmail());
        var hasEmail = booking.customerEmail() != null && !booking.customerEmail().isBlank();
        if (emailRequested && !hasEmail) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This customer has no email address — copy the link instead");
        }
        var previous = service.beginPaymentLink(id, bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "This appointment is cancelled or already paid"));
        PaymentGateway.PaymentLink created;
        var currency = serviceItem.currency() == null ? "USD" : serviceItem.currency();
        try {
            created = stripe.createPaymentLink(id, new PaymentGateway.CheckoutRequest("BOOKING", String.valueOf(bookingId), amount, currency,
                    "Appointment payment — " + serviceItem.name(), request == null ? null : request.returnUrl(),
                    booking.customerEmail(), false));
        } catch (RuntimeException error) {
            service.abandonPaymentLink(id, bookingId, previous);
            throw error;
        }
        var url = created.url();
        // Keep the link so the salon can follow up on it; any earlier open link for this appointment is retired, and
        // closed at Stripe so the customer can't pay twice.
        var actor = jwt == null || jwt.getSubject() == null ? "salon" : jwt.getSubject();
        var replaced = paymentLinks.record(id, bookingId, created.sessionId(), url, amount, currency, actor);
        replaced.forEach(session -> stripe.expireCheckout(id, session));
        var recorded = paymentLinks.bySession(id, created.sessionId()).orElseThrow();
        if (emailRequested) {
            service.sendPaymentLink(booking, serviceItem.name(), amount, currency, url);
            paymentLinks.markEmailed(id, recorded.id(), booking.customerEmail());
            recorded = paymentLinks.find(id, bookingId, recorded.id()).orElse(recorded);
        }
        return new PaymentLinkResponse(service.findById(id, bookingId).orElse(booking), url, amount, currency, emailRequested, recorded);
    }

    /** {@code amount} null refunds everything not yet refunded. */
    record RefundRequest(java.math.BigDecimal amount, String reason) {}

    record RefundResponse(Booking booking, java.math.BigDecimal refunded, String currency) {}

    /**
     * Sends back the card payment taken for an appointment — typically after cancelling a paid or deposit booking.
     * Owner only (not on the desk allowlist). The appointment's own status is left alone; a full refund moves
     * {@code paymentStatus} to {@code REFUNDED}.
     */
    @PostMapping("/api/salon-admin/{salonId}/booking/{bookingId}/refund")
    RefundResponse refund(@PathVariable String salonId, @PathVariable Long bookingId,
                          @RequestBody(required = false) RefundRequest request,
                          java.security.Principal principal) {
        var id = salonApi.resolveId(salonId);
        var booking = service.findById(id, bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        if (!"PAID".equals(booking.paymentStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This appointment has no payment to refund");
        }
        var amount = request == null ? null : request.amount();
        if (amount != null && amount.signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A refund amount must be greater than zero");
        }
        var reason = request == null || request.reason() == null || request.reason().isBlank() ? null : request.reason().strip();
        var refund = stripe.refundIfPaid(id, "BOOKING", String.valueOf(bookingId), amount, reason,
                principal == null ? "admin" : principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                        "No card payment was found for this appointment — it was paid in cash or at the desk, so refund it there."));
        if (amount == null) service.markRefunded(id, bookingId);
        return new RefundResponse(service.findById(id, bookingId).orElse(booking), refund.amount(), refund.currency());
    }

    @PostMapping("/api/salon-admin/{salonId}/booking/{bookingId}/no-show")
    ResponseEntity<Booking> noShow(@PathVariable String salonId, @PathVariable Long bookingId) {
        return service.updateStatus(salonApi.resolveId(salonId), bookingId, BookingStatus.NO_SHOW)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
