package net.samitkumar.multi_tenant_saloon.saloon.internal;

import net.samitkumar.multi_tenant_saloon.saloon.Saloon;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonFeature;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;

@RestController
@RequestMapping("/api/saloons")
class SaloonController {

    private final SaloonService service;

    SaloonController(SaloonService service) {
        this.service = service;
    }

    record CreateSaloonRequest(String name,
                               String ownerName, String ownerEmail, String ownerPhone,
                               Saloon.Location location,
                               Saloon.ContactInfo contact,
                               List<Saloon.OperatingHours> operatingHours,
                               List<SaloonFeature> features) {}

    record UpdateSaloonRequest(String name,
                               Saloon.Location location,
                               Saloon.ContactInfo contact,
                               List<Saloon.OperatingHours> operatingHours) {}

    record UpdateFeaturesRequest(List<SaloonFeature> features) {}

    @PostMapping
    ResponseEntity<Saloon> create(@RequestBody CreateSaloonRequest request) {
        var owner = new Saloon.Owner(request.ownerName(), request.ownerEmail(), request.ownerPhone());
        var saloon = service.create(request.name(), owner, request.location(), request.contact(),
                request.operatingHours(), request.features());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(saloon.id())
                .toUri();
        return ResponseEntity.created(location).body(saloon);
    }

    @GetMapping
    List<Saloon> findAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    ResponseEntity<Saloon> findById(@PathVariable String id) {
        return service.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}")
    ResponseEntity<Saloon> update(@PathVariable String id, @RequestBody UpdateSaloonRequest request) {
        return service.update(id, request.name(), request.location(), request.contact(), request.operatingHours())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/features")
    ResponseEntity<Saloon> updateFeatures(@PathVariable String id, @RequestBody UpdateFeaturesRequest request) {
        return service.updateFeatures(id, request.features())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
