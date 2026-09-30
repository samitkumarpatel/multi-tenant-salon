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

    record BookingCheckout(Booking booking, String checkoutUrl) {}

    BookingController(BookingService service, SalonApi salonApi, PaymentGateway stripe, SalonServiceApi services) {
        this.service = service;
        this.salonApi = salonApi;
        this.stripe = stripe;
        this.services = services;
    }

    record CreateBookingRequest(Long serviceId, Long staffId, String customerName,
                                String customerEmail, String customerPhone,
                                LocalDate appointmentDate, LocalTime startTime, String notes,
                                String returnUrl) {}

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
                var checkout = stripe.createCheckout(id, "BOOKING", String.valueOf(booking.id()), amount,
                        serviceItem.currency() == null ? "USD" : serviceItem.currency(), "Booking payment — " + serviceItem.name(),
                        request.returnUrl());
                return ResponseEntity.ok(new BookingCheckout(booking, checkout));
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

    @PostMapping("/api/salon-admin/{salonId}/booking/{bookingId}/no-show")
    ResponseEntity<Booking> noShow(@PathVariable String salonId, @PathVariable Long bookingId) {
        return service.updateStatus(salonApi.resolveId(salonId), bookingId, BookingStatus.NO_SHOW)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
