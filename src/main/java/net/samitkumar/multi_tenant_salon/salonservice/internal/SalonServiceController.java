package net.samitkumar.multi_tenant_salon.salonservice.internal;

import net.samitkumar.multi_tenant_salon.salonservice.ServiceCategory;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
class SalonServiceController {

    private final SalonServiceManager service;

    SalonServiceController(SalonServiceManager service) {
        this.service = service;
    }

    record AddServiceRequest(String name, String description, BigDecimal price, String currency,
                             Integer durationMinutes, ServiceCategory category, List<String> assignedStaffIds) {}

    record UpdateServiceRequest(String name, String description, BigDecimal price, String currency,
                                Integer durationMinutes, ServiceCategory category, boolean active,
                                List<String> assignedStaffIds) {}

    @GetMapping({"/api/salon/{salonId}/services", "/api/salon-admin/{salonId}/services"})
    List<ServiceItem> findAll(@PathVariable UUID salonId) {
        return service.findBySalonId(salonId);
    }

    @PostMapping("/api/salon-admin/{salonId}/services")
    ResponseEntity<ServiceItem> add(@PathVariable UUID salonId, @RequestBody AddServiceRequest request) {
        var item = service.add(salonId, request.name(), request.description(), request.price(),
                request.currency(), request.durationMinutes(), request.category(), request.assignedStaffIds());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(item.id())
                .toUri();
        return ResponseEntity.created(location).body(item);
    }

    @GetMapping({"/api/salon/{salonId}/services/{serviceId}", "/api/salon-admin/{salonId}/services/{serviceId}"})
    ResponseEntity<ServiceItem> findById(@PathVariable UUID salonId, @PathVariable Long serviceId) {
        return service.findByIdAndSalonId(serviceId, salonId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/salon-admin/{salonId}/services/{serviceId}")
    ResponseEntity<ServiceItem> update(@PathVariable UUID salonId, @PathVariable Long serviceId,
                                       @RequestBody UpdateServiceRequest request) {
        return service.update(salonId, serviceId, request.name(), request.description(), request.price(),
                        request.currency(), request.durationMinutes(), request.category(), request.active(),
                        request.assignedStaffIds())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/salon-admin/{salonId}/services/{serviceId}")
    ResponseEntity<Void> remove(@PathVariable UUID salonId, @PathVariable Long serviceId) {
        service.remove(salonId, serviceId);
        return ResponseEntity.noContent().build();
    }
}
