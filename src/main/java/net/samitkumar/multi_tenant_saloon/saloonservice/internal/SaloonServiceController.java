package net.samitkumar.multi_tenant_saloon.saloonservice.internal;

import net.samitkumar.multi_tenant_saloon.saloonservice.ServiceCategory;
import net.samitkumar.multi_tenant_saloon.saloonservice.ServiceItem;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/saloons/{saloonId}/services")
class SaloonServiceController {

    private final SaloonServiceManager service;

    SaloonServiceController(SaloonServiceManager service) {
        this.service = service;
    }

    record AddServiceRequest(String name, String description, BigDecimal price, String currency,
                             int durationMinutes, ServiceCategory category, List<String> assignedStaffIds) {}

    record UpdateServiceRequest(String name, String description, BigDecimal price, String currency,
                                int durationMinutes, ServiceCategory category, boolean active,
                                List<String> assignedStaffIds) {}

    @GetMapping
    List<ServiceItem> findAll(@PathVariable Long saloonId) {
        return service.findBySaloonId(saloonId);
    }

    @PostMapping
    ResponseEntity<ServiceItem> add(@PathVariable Long saloonId, @RequestBody AddServiceRequest request) {
        var item = service.add(saloonId, request.name(), request.description(), request.price(),
                request.currency(), request.durationMinutes(), request.category(), request.assignedStaffIds());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(item.id())
                .toUri();
        return ResponseEntity.created(location).body(item);
    }

    @GetMapping("/{serviceId}")
    ResponseEntity<ServiceItem> findById(@PathVariable Long saloonId, @PathVariable Long serviceId) {
        return service.findById(saloonId, serviceId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{serviceId}")
    ResponseEntity<ServiceItem> update(@PathVariable Long saloonId, @PathVariable Long serviceId,
                                       @RequestBody UpdateServiceRequest request) {
        return service.update(saloonId, serviceId, request.name(), request.description(), request.price(),
                        request.currency(), request.durationMinutes(), request.category(), request.active(),
                        request.assignedStaffIds())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{serviceId}")
    ResponseEntity<Void> remove(@PathVariable Long saloonId, @PathVariable Long serviceId) {
        service.remove(saloonId, serviceId);
        return ResponseEntity.noContent().build();
    }
}
