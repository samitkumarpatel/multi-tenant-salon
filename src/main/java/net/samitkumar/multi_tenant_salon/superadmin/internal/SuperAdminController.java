package net.samitkumar.multi_tenant_salon.superadmin.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
class SuperAdminController {

    private final SalonApi salonApi;

    SuperAdminController(SalonApi salonApi) {
        this.salonApi = salonApi;
    }

    @GetMapping("/api/salon-super-admin/salons")
    List<Salon> findAll(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Salon.SalonStatus status) {
        return salonApi.search(q, status);
    }

    @GetMapping("/api/salon-super-admin/salons/{id}")
    ResponseEntity<Salon> findById(@PathVariable UUID id) {
        return salonApi.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    record UpdateOwnerRequest(@NotBlank String name, @NotBlank String email, String phone) {}

    @PutMapping("/api/salon-super-admin/salons/{id}/owner")
    ResponseEntity<Salon> updateOwner(@PathVariable UUID id, @Valid @RequestBody UpdateOwnerRequest request) {
        var owner = new Salon.Owner(request.name(), request.email(), request.phone());
        return salonApi.updateOwner(id, owner)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/salon-super-admin/salons/{id}/features")
    ResponseEntity<Salon> updateFeatures(@PathVariable UUID id, @RequestBody List<SalonFeature> features) {
        return salonApi.updateFeatures(id, features)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/salon-super-admin/salons/{id}")
    ResponseEntity<Salon> disable(@PathVariable UUID id) {
        return salonApi.disable(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/salon-super-admin/salons/{id}/enable")
    ResponseEntity<Salon> enable(@PathVariable UUID id) {
        return salonApi.enable(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
