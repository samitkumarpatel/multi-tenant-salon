package net.samitkumar.multi_tenant_salon.loyalty.internal;

import net.samitkumar.multi_tenant_salon.loyalty.CustomerLoyalty;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
class LoyaltyPublicController {
    private final LoyaltyService loyalty;
    private final SalonApi salons;

    LoyaltyPublicController(LoyaltyService loyalty, SalonApi salons) {
        this.loyalty = loyalty;
        this.salons = salons;
    }

    /** The public rules and rewards for the website's loyalty page — nothing about any customer. */
    @GetMapping("/api/salon/{salonId}/loyalty")
    CustomerLoyalty rules(@PathVariable String salonId) {
        var id = salons.resolveId(salonId);
        var program = loyalty.program(id);
        if (!loyalty.featureOn(id) || !program.enabled()) return new CustomerLoyalty(false, 0, program, List.of(), List.of(), List.of());
        return new CustomerLoyalty(true, 0, program, loyalty.rewards(id, true), List.of(), List.of());
    }
}
