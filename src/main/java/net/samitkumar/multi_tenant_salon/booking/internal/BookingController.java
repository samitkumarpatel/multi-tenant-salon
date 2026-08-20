package net.samitkumar.multi_tenant_salon.booking.internal;

import net.samitkumar.multi_tenant_salon.booking.AvailableSlot;
import net.samitkumar.multi_tenant_salon.booking.Booking;
import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@RestController
class BookingController {

    private final BookingService service;

    BookingController(BookingService service) {
        this.service = service;
    }

    record CreateBookingRequest(Long serviceId, Long staffId, String customerName,
                                String customerEmail, String customerPhone,
                                LocalDate appointmentDate, LocalTime startTime, String notes) {}

    record UpdateBookingRequest(LocalDate appointmentDate, LocalTime startTime, Long staffId, String notes) {}

    @GetMapping({"/api/salon/{salonId}/slots", "/api/salon-admin/{salonId}/slots"})
    List<AvailableSlot> getAvailableSlots(
            @PathVariable UUID salonId,
            @RequestParam Long serviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) Long staffId) {
        return service.findAvailableSlots(salonId, serviceId, date, staffId);
    }

    @GetMapping("/api/salon-admin/{salonId}/booking")
    List<Booking> listBookings(@PathVariable UUID salonId) {
        return service.findAll(salonId);
    }

    @PostMapping({"/api/salon/{salonId}/booking", "/api/salon-admin/{salonId}/booking"})
    ResponseEntity<Booking> createBooking(@PathVariable UUID salonId,
                                          @RequestBody CreateBookingRequest request) {
        var hasEmail = request.customerEmail() != null && !request.customerEmail().isBlank();
        var hasPhone = request.customerPhone() != null && !request.customerPhone().isBlank();
        if (!hasEmail && !hasPhone) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Either email or phone number is required");
        }
        var booking = service.create(salonId, request.serviceId(), request.staffId(),
                request.customerName(), request.customerEmail(), request.customerPhone(),
                request.appointmentDate(), request.startTime(), request.notes());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(booking.id())
                .toUri();
        return ResponseEntity.created(location).body(booking);
    }

    @GetMapping("/api/salon-admin/{salonId}/booking/{bookingId}")
    ResponseEntity<Booking> getBooking(@PathVariable UUID salonId, @PathVariable Long bookingId) {
        return service.findById(salonId, bookingId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/salon-admin/{salonId}/booking/{bookingId}")
    ResponseEntity<Booking> reschedule(@PathVariable UUID salonId, @PathVariable Long bookingId,
                                       @RequestBody UpdateBookingRequest request) {
        return service.reschedule(salonId, bookingId, request.appointmentDate(),
                        request.startTime(), request.staffId(), request.notes())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/salon-admin/{salonId}/booking/{bookingId}")
    ResponseEntity<Void> deleteBooking(@PathVariable UUID salonId, @PathVariable Long bookingId) {
        service.delete(salonId, bookingId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/salon-admin/{salonId}/booking/{bookingId}/confirm")
    ResponseEntity<Booking> confirm(@PathVariable UUID salonId, @PathVariable Long bookingId) {
        return service.updateStatus(salonId, bookingId, BookingStatus.CONFIRMED)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/api/salon-admin/{salonId}/booking/{bookingId}/cancel")
    ResponseEntity<Booking> cancel(@PathVariable UUID salonId, @PathVariable Long bookingId) {
        return service.updateStatus(salonId, bookingId, BookingStatus.CANCELLED)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/api/salon-admin/{salonId}/booking/{bookingId}/complete")
    ResponseEntity<Booking> complete(@PathVariable UUID salonId, @PathVariable Long bookingId) {
        return service.updateStatus(salonId, bookingId, BookingStatus.COMPLETED)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/api/salon-admin/{salonId}/booking/{bookingId}/no-show")
    ResponseEntity<Booking> noShow(@PathVariable UUID salonId, @PathVariable Long bookingId) {
        return service.updateStatus(salonId, bookingId, BookingStatus.NO_SHOW)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
