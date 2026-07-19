package net.samitkumar.multi_tenant_saloon.saloon.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import net.samitkumar.multi_tenant_saloon.saloon.Saloon;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonFeature;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;
import java.util.UUID;

@RestController
class SaloonController {

    private final SaloonService service;

    SaloonController(SaloonService service) {
        this.service = service;
    }

    record CreateSaloonRequest(
            @NotBlank String name,
            @NotBlank String ownerName,
            @NotBlank String ownerEmail,
            String ownerPhone,
            Saloon.Location location,
            Saloon.ContactInfo contact,
            List<Saloon.OperatingHours> operatingHours,
            List<SaloonFeature> features) {}

    record CreateSaloonResponse(UUID id, String handler) {}

    record UpdateSaloonRequest(String name,
                               Saloon.Location location,
                               Saloon.ContactInfo contact,
                               List<Saloon.OperatingHours> operatingHours,
                               Integer bookingAdvanceDays) {}

    @PostMapping("/api/saloon-onboarding")
    ResponseEntity<CreateSaloonResponse> create(@Valid @RequestBody CreateSaloonRequest request) {
        var owner = new Saloon.Owner(request.ownerName(), request.ownerEmail(), request.ownerPhone());
        var saloon = service.create(request.name(), owner, request.location(), request.contact(),
                request.operatingHours(), request.features());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .replacePath("/api/saloon/{id}")
                .buildAndExpand(saloon.id())
                .toUri();
        return ResponseEntity.created(location).body(new CreateSaloonResponse(saloon.id(), saloon.handler()));
    }

    @GetMapping("/api/saloon-onboarding")
    List<Saloon> findAll() {
        return service.findAll();
    }

    @GetMapping({"/api/saloon/{id}", "/api/saloon-admin/{id}"})
    ResponseEntity<Saloon> findByIdOrHandler(@PathVariable String id) {
        return service.findByIdOrHandler(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/saloon-admin/{id}")
    ResponseEntity<Saloon> update(@PathVariable UUID id, @RequestBody UpdateSaloonRequest request) {
        return service.update(id, request.name(), request.location(), request.contact(), request.operatingHours(), request.bookingAdvanceDays())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/saloon-admin/{id}/features")
    ResponseEntity<Saloon> updateFeatures(@PathVariable UUID id, @RequestBody List<SaloonFeature> features) {
        return service.updateFeatures(id, features)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/saloon-admin/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/saloon-admin/{id}/website/publish")
    ResponseEntity<Void> publishWebsite(@PathVariable UUID id) {
        return switch (service.publishWebsite(id)) {
            case OK -> ResponseEntity.accepted().build();
            case NOT_FOUND -> ResponseEntity.notFound().build();
            case FEATURE_NOT_ENABLED -> ResponseEntity.unprocessableEntity().build();
        };
    }
}
