package net.samitkumar.multi_tenant_saloon.booking.internal;

import net.samitkumar.multi_tenant_saloon.booking.StaffAvailability;
import net.samitkumar.multi_tenant_saloon.booking.StaffAvailabilityOverride;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/saloon-admin/{saloonId}/staff/{staffId}/availability")
class AvailabilityController {

    private final BookingService service;

    AvailabilityController(BookingService service) {
        this.service = service;
    }

    record DayScheduleRequest(DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime, boolean available) {}

    record AddOverrideRequest(LocalDate overrideDate, LocalTime startTime, LocalTime endTime,
                              boolean available, String reason) {}

    @GetMapping
    List<StaffAvailability> getAvailability(@PathVariable UUID saloonId, @PathVariable Long staffId) {
        return service.getAvailability(saloonId, staffId);
    }

    @PutMapping
    List<StaffAvailability> setAvailability(@PathVariable UUID saloonId, @PathVariable Long staffId,
                                            @RequestBody List<DayScheduleRequest> schedule) {
        var entries = schedule.stream()
                .map(r -> new StaffAvailability(null, saloonId, staffId, r.dayOfWeek(),
                        r.startTime(), r.endTime(), r.available()))
                .toList();
        return service.setAvailability(saloonId, staffId, entries);
    }

    @GetMapping("/overrides")
    List<StaffAvailabilityOverride> getOverrides(@PathVariable UUID saloonId, @PathVariable Long staffId) {
        return service.getOverrides(saloonId, staffId);
    }

    @PostMapping("/overrides")
    ResponseEntity<StaffAvailabilityOverride> addOverride(@PathVariable UUID saloonId,
                                                          @PathVariable Long staffId,
                                                          @RequestBody AddOverrideRequest request) {
        var override = new StaffAvailabilityOverride(null, saloonId, staffId,
                request.overrideDate(), request.startTime(), request.endTime(),
                request.available(), request.reason());
        var saved = service.addOverride(saloonId, staffId, override);
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(saved.id())
                .toUri();
        return ResponseEntity.created(location).body(saved);
    }

    @DeleteMapping("/overrides/{overrideId}")
    ResponseEntity<Void> removeOverride(@PathVariable UUID saloonId, @PathVariable Long staffId,
                                        @PathVariable Long overrideId) {
        service.removeOverride(saloonId, staffId, overrideId);
        return ResponseEntity.noContent().build();
    }
}
