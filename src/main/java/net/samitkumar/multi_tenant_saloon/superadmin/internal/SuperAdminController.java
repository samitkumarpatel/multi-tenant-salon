package net.samitkumar.multi_tenant_saloon.superadmin.internal;

import net.samitkumar.multi_tenant_saloon.saloon.Saloon;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonApi;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonFeature;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
class SuperAdminController {

    private final SaloonApi saloonApi;

    SuperAdminController(SaloonApi saloonApi) {
        this.saloonApi = saloonApi;
    }

    @GetMapping("/api/saloon-super-admin/saloons")
    List<Saloon> findAll() {
        return saloonApi.findAll();
    }

    @GetMapping("/api/saloon-super-admin/saloons/{id}")
    ResponseEntity<Saloon> findById(@PathVariable UUID id) {
        return saloonApi.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/saloon-super-admin/saloons/{id}/features")
    ResponseEntity<Saloon> updateFeatures(@PathVariable UUID id, @RequestBody List<SaloonFeature> features) {
        return saloonApi.updateFeatures(id, features)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/saloon-super-admin/saloons/{id}")
    ResponseEntity<Saloon> disable(@PathVariable UUID id) {
        return saloonApi.disable(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/saloon-super-admin/saloons/{id}/enable")
    ResponseEntity<Saloon> enable(@PathVariable UUID id) {
        return saloonApi.enable(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
