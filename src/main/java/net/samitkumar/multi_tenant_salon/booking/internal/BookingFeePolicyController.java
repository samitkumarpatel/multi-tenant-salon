package net.samitkumar.multi_tenant_salon.booking.internal;

import net.samitkumar.multi_tenant_salon.booking.BookingFeePolicy;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.web.bind.annotation.*;

/**
 * The salon's no-show fee. The owner edits it under {@code /api/salon-admin/{salonId}/booking-fee-policy}
 * (owner-gated, not on the desk-staff allowlist); the public read lets the booking page tell customers.
 */
@RestController
class BookingFeePolicyController {

    private final BookingFeePolicies policies;
    private final SalonApi salonApi;

    BookingFeePolicyController(BookingFeePolicies policies, SalonApi salonApi) {
        this.policies = policies;
        this.salonApi = salonApi;
    }

    @GetMapping({"/api/salon/{salonId}/booking-fee-policy", "/api/salon-admin/{salonId}/booking-fee-policy"})
    BookingFeePolicy get(@PathVariable String salonId) {
        return policies.get(salonApi.resolveId(salonId));
    }

    @PutMapping("/api/salon-admin/{salonId}/booking-fee-policy")
    BookingFeePolicy put(@PathVariable String salonId, @RequestBody BookingFeePolicy policy) {
        return policies.save(salonApi.resolveId(salonId), policy);
    }
}
