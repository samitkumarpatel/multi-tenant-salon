package net.samitkumar.multi_tenant_salon.salon.internal;

import jakarta.validation.Valid;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.CacheControl;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
class SalonPolicyController {
    private final SalonApi salons;
    private final SalonPolicyService policies;

    SalonPolicyController(SalonApi salons, SalonPolicyService policies) {
        this.salons = salons;
        this.policies = policies;
    }

    @GetMapping("/api/salon-admin/{salonId}/policies")
    List<SalonPolicy> editor(@PathVariable String salonId) {
        return policies.editor(salons.resolveId(salonId));
    }

    @PutMapping("/api/salon-admin/{salonId}/policies")
    List<SalonPolicy> save(@PathVariable String salonId, @Valid @RequestBody List<@Valid SalonPolicy> request) {
        return policies.save(salons.resolveId(salonId), request);
    }

    @PostMapping("/api/salon-admin/{salonId}/policies/publish")
    List<SalonPolicy> publish(@PathVariable String salonId) {
        return policies.publish(salons.resolveId(salonId));
    }

    @GetMapping("/api/salon/{salonId}/policies")
    org.springframework.http.ResponseEntity<List<SalonPolicy>> publicPolicies(@PathVariable String salonId,
            @RequestParam(defaultValue = "website") String placement) {
        if (!List.of("website", "booking").contains(placement)) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Unknown policy placement.");
        }
        return org.springframework.http.ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(policies.published(salons.resolveId(salonId), placement));
    }
}
