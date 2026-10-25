package net.samitkumar.multi_tenant_salon.customer.internal;

import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.web.bind.annotation.*;

/**
 * The owner's rules for customers changing their own appointments —
 * {@code /api/salon-admin/{salonId}/customer-self-service}, owner-gated by the security config's
 * {@code /api/salon-admin/{salonId}/**} rule (not on the desk-staff allowlist).
 */
@RestController
@RequestMapping("/api/salon-admin/{salonId}/customer-self-service")
class SelfServicePolicyController {

    private final SelfServicePolicies policies;
    private final SalonApi salonApi;

    SelfServicePolicyController(SelfServicePolicies policies, SalonApi salonApi) {
        this.policies = policies;
        this.salonApi = salonApi;
    }

    @GetMapping
    SelfServicePolicy get(@PathVariable String salonId) {
        return policies.get(salonApi.resolveId(salonId));
    }

    @PutMapping
    SelfServicePolicy put(@PathVariable String salonId, @RequestBody SelfServicePolicy policy) {
        return policies.save(salonApi.resolveId(salonId), policy);
    }
}
