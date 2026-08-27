package net.samitkumar.multi_tenant_salon.superadmin.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
    ResponseEntity<Salon> findById(@PathVariable String id) {
        return salonApi.findById(salonApi.resolveId(id))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    record UpdateOwnerRequest(@NotBlank String name, @NotBlank String email, String phone) {}

    @PutMapping("/api/salon-super-admin/salons/{id}/owner")
    ResponseEntity<Salon> updateOwner(@PathVariable String id, @Valid @RequestBody UpdateOwnerRequest request) {
        var owner = new Salon.Owner(request.name(), request.email(), request.phone());
        return salonApi.updateOwner(salonApi.resolveId(id), owner)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/salon-super-admin/salons/{id}/features")
    ResponseEntity<Salon> updateFeatures(@PathVariable String id, @RequestBody List<SalonFeature> features) {
        return salonApi.updateFeatures(salonApi.resolveId(id), features)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/salon-super-admin/salons/{id}")
    ResponseEntity<Salon> disable(@PathVariable String id) {
        return salonApi.disable(salonApi.resolveId(id))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/salon-super-admin/salons/{id}/enable")
    ResponseEntity<Salon> enable(@PathVariable String id) {
        return salonApi.enable(salonApi.resolveId(id))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
