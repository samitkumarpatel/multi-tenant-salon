package net.samitkumar.multi_tenant_saloon.booking.internal;

import net.samitkumar.multi_tenant_saloon.booking.AvailableSlot;
import net.samitkumar.multi_tenant_saloon.booking.Booking;
import net.samitkumar.multi_tenant_saloon.booking.BookingStatus;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/saloons/{saloonId}")
class BookingController {

    private final BookingService service;

    BookingController(BookingService service) {
        this.service = service;
    }

    record CreateBookingRequest(Long serviceId, Long staffId, String customerName,
                                String customerEmail, String customerPhone,
                                LocalDate appointmentDate, LocalTime startTime, String notes) {}

    record UpdateBookingRequest(LocalDate appointmentDate, LocalTime startTime, Long staffId, String notes) {}

    @GetMapping("/slots")
    List<AvailableSlot> getAvailableSlots(
            @PathVariable UUID saloonId,
            @RequestParam Long serviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) Long staffId) {
        return service.findAvailableSlots(saloonId, serviceId, date, staffId);
    }

    @GetMapping("/bookings")
    List<Booking> listBookings(@PathVariable UUID saloonId) {
        return service.findAll(saloonId);
    }

    @PostMapping("/bookings")
    ResponseEntity<Booking> createBooking(@PathVariable UUID saloonId,
                                          @RequestBody CreateBookingRequest request) {
        var booking = service.create(saloonId, request.serviceId(), request.staffId(),
                request.customerName(), request.customerEmail(), request.customerPhone(),
                request.appointmentDate(), request.startTime(), request.notes());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(booking.id())
                .toUri();
        return ResponseEntity.created(location).body(booking);
    }

    @GetMapping("/bookings/{bookingId}")
    ResponseEntity<Booking> getBooking(@PathVariable UUID saloonId, @PathVariable Long bookingId) {
        return service.findById(saloonId, bookingId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/bookings/{bookingId}")
    ResponseEntity<Booking> reschedule(@PathVariable UUID saloonId, @PathVariable Long bookingId,
                                       @RequestBody UpdateBookingRequest request) {
        return service.reschedule(saloonId, bookingId, request.appointmentDate(),
                        request.startTime(), request.staffId(), request.notes())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/bookings/{bookingId}")
    ResponseEntity<Void> deleteBooking(@PathVariable UUID saloonId, @PathVariable Long bookingId) {
        service.delete(saloonId, bookingId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/bookings/{bookingId}/confirm")
    ResponseEntity<Booking> confirm(@PathVariable UUID saloonId, @PathVariable Long bookingId) {
        return service.updateStatus(saloonId, bookingId, BookingStatus.CONFIRMED)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/bookings/{bookingId}/cancel")
    ResponseEntity<Booking> cancel(@PathVariable UUID saloonId, @PathVariable Long bookingId) {
        return service.updateStatus(saloonId, bookingId, BookingStatus.CANCELLED)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/bookings/{bookingId}/complete")
    ResponseEntity<Booking> complete(@PathVariable UUID saloonId, @PathVariable Long bookingId) {
        return service.updateStatus(saloonId, bookingId, BookingStatus.COMPLETED)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/bookings/{bookingId}/no-show")
    ResponseEntity<Booking> noShow(@PathVariable UUID saloonId, @PathVariable Long bookingId) {
        return service.updateStatus(saloonId, bookingId, BookingStatus.NO_SHOW)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
