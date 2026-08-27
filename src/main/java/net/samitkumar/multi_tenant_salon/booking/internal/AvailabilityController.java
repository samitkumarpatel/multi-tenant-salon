package net.samitkumar.multi_tenant_salon.booking.internal;

import net.samitkumar.multi_tenant_salon.booking.StaffAvailability;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverride;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@RestController
@RequestMapping("/api/salon-admin/{salonId}/staff/{staffId}/availability")
class AvailabilityController {

    private final BookingService service;
    private final SalonApi salonApi;

    AvailabilityController(BookingService service, SalonApi salonApi) {
        this.service = service;
        this.salonApi = salonApi;
    }

    record DayScheduleRequest(DayOfWeek dayOfWeek, LocalTime startTime, LocalTime endTime, boolean available) {}

    record AddOverrideRequest(LocalDate overrideDate, LocalTime startTime, LocalTime endTime,
                              boolean available, String reason) {}

    @GetMapping
    List<StaffAvailability> getAvailability(@PathVariable String salonId, @PathVariable Long staffId) {
        return service.getAvailability(salonApi.resolveId(salonId), staffId);
    }

    @PutMapping
    List<StaffAvailability> setAvailability(@PathVariable String salonId, @PathVariable Long staffId,
                                            @RequestBody List<DayScheduleRequest> schedule) {
        var resolvedSalonId = salonApi.resolveId(salonId);
        var entries = schedule.stream()
                .map(r -> new StaffAvailability(null, resolvedSalonId, staffId, r.dayOfWeek(),
                        r.startTime(), r.endTime(), r.available()))
                .toList();
        return service.setAvailability(resolvedSalonId, staffId, entries);
    }

    @GetMapping("/overrides")
    List<StaffAvailabilityOverride> getOverrides(@PathVariable String salonId, @PathVariable Long staffId) {
        return service.getOverrides(salonApi.resolveId(salonId), staffId);
    }

    @PostMapping("/overrides")
    ResponseEntity<StaffAvailabilityOverride> addOverride(@PathVariable String salonId,
                                                          @PathVariable Long staffId,
                                                          @RequestBody AddOverrideRequest request) {
        var resolvedSalonId = salonApi.resolveId(salonId);
        var override = new StaffAvailabilityOverride(null, resolvedSalonId, staffId,
                request.overrideDate(), request.startTime(), request.endTime(),
                request.available(), request.reason());
        var saved = service.addOverride(resolvedSalonId, staffId, override);
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(saved.id())
                .toUri();
        return ResponseEntity.created(location).body(saved);
    }

    @DeleteMapping("/overrides/{overrideId}")
    ResponseEntity<Void> removeOverride(@PathVariable String salonId, @PathVariable Long staffId,
                                        @PathVariable Long overrideId) {
        service.removeOverride(salonApi.resolveId(salonId), staffId, overrideId);
        return ResponseEntity.noContent().build();
    }
}
