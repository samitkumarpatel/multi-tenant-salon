package net.samitkumar.multi_tenant_salon.salonservice.internal;

import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceCategory;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.math.BigDecimal;
import java.util.List;

@RestController
class SalonServiceController {

    private final SalonServiceManager service;
    private final SalonApi salonApi;

    SalonServiceController(SalonServiceManager service, SalonApi salonApi) {
        this.service = service;
        this.salonApi = salonApi;
    }

    record AddServiceRequest(String name, String description, BigDecimal price, String currency,
                             Integer durationMinutes, ServiceCategory category, List<String> assignedStaffIds) {}

    record UpdateServiceRequest(String name, String description, BigDecimal price, String currency,
                                Integer durationMinutes, ServiceCategory category, boolean active,
                                List<String> assignedStaffIds) {}

    @GetMapping({"/api/salon/{salonId}/services", "/api/salon-admin/{salonId}/services"})
    List<ServiceItem> findAll(@PathVariable String salonId) {
        return service.findBySalonId(salonApi.resolveId(salonId));
    }

    @PostMapping("/api/salon-admin/{salonId}/services")
    ResponseEntity<ServiceItem> add(@PathVariable String salonId, @RequestBody AddServiceRequest request) {
        var item = service.add(salonApi.resolveId(salonId), request.name(), request.description(), request.price(),
                request.currency(), request.durationMinutes(), request.category(), request.assignedStaffIds());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(item.id())
                .toUri();
        return ResponseEntity.created(location).body(item);
    }

    @GetMapping({"/api/salon/{salonId}/services/{serviceId}", "/api/salon-admin/{salonId}/services/{serviceId}"})
    ResponseEntity<ServiceItem> findById(@PathVariable String salonId, @PathVariable Long serviceId) {
        return service.findByIdAndSalonId(serviceId, salonApi.resolveId(salonId))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/salon-admin/{salonId}/services/{serviceId}")
    ResponseEntity<ServiceItem> update(@PathVariable String salonId, @PathVariable Long serviceId,
                                       @RequestBody UpdateServiceRequest request) {
        return service.update(salonApi.resolveId(salonId), serviceId, request.name(), request.description(), request.price(),
                        request.currency(), request.durationMinutes(), request.category(), request.active(),
                        request.assignedStaffIds())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/salon-admin/{salonId}/services/{serviceId}")
    ResponseEntity<Void> remove(@PathVariable String salonId, @PathVariable Long serviceId) {
        service.remove(salonApi.resolveId(salonId), serviceId);
        return ResponseEntity.noContent().build();
    }
}
