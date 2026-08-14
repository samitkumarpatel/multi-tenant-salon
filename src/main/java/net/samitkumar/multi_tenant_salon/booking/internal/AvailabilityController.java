package net.samitkumar.multi_tenant_salon.booking.internal;

import net.samitkumar.multi_tenant_salon.booking.StaffAvailability;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverride;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/salon-admin/{salonId}/staff/{staffId}/availability")
class AvailabilityController {

    private final BookingService service;

    AvailabilityController(BookingService service) {
        this.service = service;
    }

    record DayScheduleRequest(DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime, boolean available) {}

    record AddOverrideRequest(LocalDate overrideDate, LocalTime startTime, LocalTime endTime,
                              boolean available, String reason) {}

    @GetMapping
    List<StaffAvailability> getAvailability(@PathVariable UUID salonId, @PathVariable Long staffId) {
        return service.getAvailability(salonId, staffId);
    }

    @PutMapping
    List<StaffAvailability> setAvailability(@PathVariable UUID salonId, @PathVariable Long staffId,
                                            @RequestBody List<DayScheduleRequest> schedule) {
        var entries = schedule.stream()
                .map(r -> new StaffAvailability(null, salonId, staffId, r.dayOfWeek(),
                        r.startTime(), r.endTime(), r.available()))
                .toList();
        return service.setAvailability(salonId, staffId, entries);
    }

    @GetMapping("/overrides")
    List<StaffAvailabilityOverride> getOverrides(@PathVariable UUID salonId, @PathVariable Long staffId) {
        return service.getOverrides(salonId, staffId);
    }

    @PostMapping("/overrides")
    ResponseEntity<StaffAvailabilityOverride> addOverride(@PathVariable UUID salonId,
                                                          @PathVariable Long staffId,
                                                          @RequestBody AddOverrideRequest request) {
        var override = new StaffAvailabilityOverride(null, salonId, staffId,
                request.overrideDate(), request.startTime(), request.endTime(),
                request.available(), request.reason());
        var saved = service.addOverride(salonId, staffId, override);
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(saved.id())
                .toUri();
        return ResponseEntity.created(location).body(saved);
    }

    @DeleteMapping("/overrides/{overrideId}")
    ResponseEntity<Void> removeOverride(@PathVariable UUID salonId, @PathVariable Long staffId,
                                        @PathVariable Long overrideId) {
        service.removeOverride(salonId, staffId, overrideId);
        return ResponseEntity.noContent().build();
    }
}
