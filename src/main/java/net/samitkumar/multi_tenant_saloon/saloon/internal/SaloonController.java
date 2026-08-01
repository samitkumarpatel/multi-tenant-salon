package net.samitkumar.multi_tenant_saloon.saloon.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import net.samitkumar.multi_tenant_saloon.saloon.Saloon;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonClosure;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonFeature;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.time.LocalDate;
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
            List<SaloonFeature> features,
            String businessRegistrationId,
            Boolean showBusinessId) {}

    record CreateSaloonResponse(UUID saloonId, String saloonHandler, String emailId, String message) {}

    record UpdateSaloonRequest(@NotBlank String name,
                               Saloon.Location location,
                               Saloon.ContactInfo contact,
                               List<Saloon.OperatingHours> operatingHours,
                               Integer bookingAdvanceDays,
                               String businessRegistrationId,
                               Boolean showBusinessId) {}

    @PostMapping("/api/saloon-onboarding")
    ResponseEntity<CreateSaloonResponse> create(@Valid @RequestBody CreateSaloonRequest request) {
        var owner = new Saloon.Owner(request.ownerName(), request.ownerEmail(), request.ownerPhone());
        var saloon = service.create(request.name(), owner, request.location(), request.contact(),
                request.operatingHours(), request.features(),
                request.businessRegistrationId(), request.showBusinessId());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .replacePath("/api/saloon/{id}")
                .buildAndExpand(saloon.id())
                .toUri();
        return ResponseEntity.created(location).body(new CreateSaloonResponse(
                saloon.id(),
                saloon.handler(),
                owner.email(),
                "Welcome! We've sent a login link and setup guide to " + owner.email() + ". Use your email to sign in to the admin panel."
        ));
    }

    @GetMapping("/api/saloon-onboarding")
    List<Saloon> findAll() {
        return service.findAll();
    }

    @GetMapping("/api/saloon-admin/my-saloons")
    ResponseEntity<List<Saloon>> findMysSaloons(@RequestParam String email) {
        var saloons = service.findByOwnerEmail(email);
        if (saloons.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(saloons);
    }

    @GetMapping({"/api/saloon/{id}", "/api/saloon-admin/{id}"})
    ResponseEntity<Saloon> findByIdOrHandler(@PathVariable String id) {
        return service.findByIdOrHandler(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/saloon-admin/{id}")
    ResponseEntity<Saloon> update(@PathVariable UUID id, @Valid @RequestBody UpdateSaloonRequest request) {
        return service.update(id, request.name(), request.location(), request.contact(), request.operatingHours(), request.bookingAdvanceDays(),
                        request.businessRegistrationId(), request.showBusinessId())
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

    record AddClosureRequest(@NotNull LocalDate startDate, @NotNull LocalDate endDate, String reason) {}

    @GetMapping({"/api/saloon/{id}/closures", "/api/saloon-admin/{id}/closures"})
    List<SaloonClosure> listClosures(@PathVariable UUID id) {
        return service.findClosures(id);
    }

    @PostMapping("/api/saloon-admin/{id}/closures")
    ResponseEntity<SaloonClosure> addClosure(@PathVariable UUID id, @Valid @RequestBody AddClosureRequest request) {
        var closure = service.addClosure(id, request.startDate(), request.endDate(), request.reason());
        return ResponseEntity.ok(closure);
    }

    @DeleteMapping("/api/saloon-admin/{id}/closures/{closureId}")
    ResponseEntity<Void> removeClosure(@PathVariable UUID id, @PathVariable Long closureId) {
        service.removeClosure(id, closureId);
        return ResponseEntity.noContent().build();
    }
}
