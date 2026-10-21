package net.samitkumar.multi_tenant_salon.membership.internal;

import net.samitkumar.multi_tenant_salon.membership.internal.MembershipManager.CheckoutSpec;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.Catalog;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.CheckoutResult;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.PlanView;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.RenewalView;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Public, anonymous membership catalogue, sign-up and renewal — {@code /api/salon/{salonId}/membership/**},
 * covered by the security config's {@code /api/salon/**} permit-all rule. Only plans on sale are
 * shown, and only for salons with the MEMBERSHIP feature. Sign-up and renewal each return a one-time
 * Stripe Checkout URL, as the shop's checkout does; the period starts (and the QR email goes out)
 * when Stripe confirms the payment. The renewal token in the reminder email is the only credential.
 */
@RestController
@RequestMapping("/api/salon/{salonId}/membership")
class MembershipPublicController {
    private final MembershipManager memberships;
    private final SalonApi salonApi;

    MembershipPublicController(MembershipManager memberships, SalonApi salonApi) {
        this.memberships = memberships;
        this.salonApi = salonApi;
    }

    @GetMapping("/plans")
    Catalog plans(@PathVariable String salonId) {
        return memberships.catalog(salonApi.resolveId(salonId));
    }

    @GetMapping("/plans/{planId}")
    ResponseEntity<PlanView> plan(@PathVariable String salonId, @PathVariable Long planId) {
        return ResponseEntity.of(memberships.publicPlan(salonApi.resolveId(salonId), planId));
    }

    @PostMapping("/checkout")
    @ResponseStatus(HttpStatus.CREATED)
    CheckoutResult checkout(@PathVariable String salonId, @RequestBody CheckoutSpec spec) {
        return memberships.startCheckout(salonApi.resolveId(salonId), spec);
    }

    record RenewalRequest(String returnUrl) {}

    @GetMapping("/renewals/{token}")
    RenewalView renewal(@PathVariable String salonId, @PathVariable String token) {
        return memberships.renewal(salonApi.resolveId(salonId), token);
    }

    @PostMapping("/renewals/{token}/checkout")
    @ResponseStatus(HttpStatus.CREATED)
    CheckoutResult renew(@PathVariable String salonId, @PathVariable String token,
                         @RequestBody(required = false) RenewalRequest req) {
        return memberships.startRenewal(salonApi.resolveId(salonId), token, req == null ? null : req.returnUrl());
    }
}
