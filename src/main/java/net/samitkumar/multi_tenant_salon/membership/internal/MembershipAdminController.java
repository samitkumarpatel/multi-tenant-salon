package net.samitkumar.multi_tenant_salon.membership.internal;

import net.samitkumar.multi_tenant_salon.membership.MembershipPlan;
import net.samitkumar.multi_tenant_salon.membership.MembershipSubscription;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipManager.DeskSaleSpec;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipManager.PlanSpec;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipManager.SubscriptionFilter;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.CheckoutResult;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.Overview;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.PlanView;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.SubscriptionDetail;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.SubscriptionPage;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.math.BigDecimal;
import java.util.List;

/**
 * Owner/admin surface for memberships — plans, members, payments and the overview. All paths are
 * {@code /api/salon-admin/{salonId}/membership/**}, owner-gated by the security config's
 * {@code /api/salon-admin/{salonId}/**} rule.
 */
@RestController
@RequestMapping("/api/salon-admin/{salonId}/membership")
class MembershipAdminController {
    /**
     * Who did it, for the member's timeline: the signed-in person's email, so a cancellation, refund or
     * desk sale can be traced to someone. Falls back to a role label only when security is off locally.
     */
    private static String actor(Jwt jwt) {
        return jwt == null || jwt.getSubject() == null ? "admin" : jwt.getSubject();
    }

    private final MembershipManager memberships;
    private final SalonApi salonApi;

    MembershipAdminController(MembershipManager memberships, SalonApi salonApi) {
        this.memberships = memberships;
        this.salonApi = salonApi;
    }

    record PlanOrderRequest(List<Long> planIds) {}

    record CancelRequest(Boolean atPeriodEnd, String reason) {}

    record NoteRequest(String note) {}

    record ContactRequest(String customerName, String customerEmail, String customerPhone) {}

    record RefundRequest(BigDecimal amount, String reason) {}

    // ── plans ────────────────────────────────────────────────────────────────

    @GetMapping("/plans")
    List<PlanView> listPlans(@PathVariable String salonId) {
        return memberships.listPlans(salonApi.resolveId(salonId));
    }

    @PostMapping("/plans")
    ResponseEntity<PlanView> createPlan(@PathVariable String salonId, @RequestBody PlanSpec spec) {
        var plan = memberships.createPlan(salonApi.resolveId(salonId), spec);
        var location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(plan.id()).toUri();
        return ResponseEntity.created(location).body(plan);
    }

    @GetMapping("/plans/{planId}")
    ResponseEntity<PlanView> getPlan(@PathVariable String salonId, @PathVariable Long planId) {
        return ResponseEntity.of(memberships.getPlan(salonApi.resolveId(salonId), planId));
    }

    @PutMapping("/plans/{planId}")
    ResponseEntity<PlanView> updatePlan(@PathVariable String salonId, @PathVariable Long planId, @RequestBody PlanSpec spec) {
        return ResponseEntity.of(memberships.updatePlan(salonApi.resolveId(salonId), planId, spec));
    }

    @DeleteMapping("/plans/{planId}")
    ResponseEntity<Void> deletePlan(@PathVariable String salonId, @PathVariable Long planId) {
        return memberships.deletePlan(salonApi.resolveId(salonId), planId)
                ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @PutMapping("/plans/order")
    List<PlanView> reorderPlans(@PathVariable String salonId, @RequestBody PlanOrderRequest req) {
        return memberships.reorderPlans(salonApi.resolveId(salonId), req.planIds());
    }

    // ── members ──────────────────────────────────────────────────────────────

    @GetMapping("/subscriptions")
    SubscriptionPage listSubscriptions(@PathVariable String salonId,
                                       @RequestParam(required = false) MembershipSubscription.Status status,
                                       @RequestParam(required = false) Long planId,
                                       @RequestParam(required = false) String q,
                                       @RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "50") int size) {
        return memberships.listSubscriptions(salonApi.resolveId(salonId), new SubscriptionFilter(status, planId, q), page, size);
    }

    @GetMapping("/subscriptions/{subscriptionId}")
    ResponseEntity<SubscriptionDetail> getSubscription(@PathVariable String salonId, @PathVariable Long subscriptionId) {
        return ResponseEntity.of(memberships.detail(salonApi.resolveId(salonId), subscriptionId));
    }

    @GetMapping(value = "/subscriptions/{subscriptionId}/qr.png", produces = MediaType.IMAGE_PNG_VALUE)
    ResponseEntity<byte[]> qrCode(@PathVariable String salonId, @PathVariable Long subscriptionId) {
        return memberships.qrPng(salonApi.resolveId(salonId), subscriptionId)
                .map(png -> ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.IMAGE_PNG).body(png))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/subscriptions/{subscriptionId}/cancel")
    SubscriptionDetail cancel(@PathVariable String salonId, @PathVariable Long subscriptionId,
                              @RequestBody(required = false) CancelRequest req,
                              @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        boolean atPeriodEnd = req == null || req.atPeriodEnd() == null || req.atPeriodEnd();
        return memberships.cancel(salonApi.resolveId(salonId), subscriptionId, atPeriodEnd,
                req == null ? null : req.reason(), actor(jwt));
    }

    @PostMapping("/subscriptions/{subscriptionId}/resume")
    SubscriptionDetail resume(@PathVariable String salonId, @PathVariable Long subscriptionId,
                              @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        return memberships.resume(salonApi.resolveId(salonId), subscriptionId, actor(jwt));
    }

    @PatchMapping("/subscriptions/{subscriptionId}/contact")
    SubscriptionDetail updateContact(@PathVariable String salonId, @PathVariable Long subscriptionId,
                                     @RequestBody ContactRequest req,
                                     @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        return memberships.updateContact(salonApi.resolveId(salonId), subscriptionId,
                req.customerName(), req.customerEmail(), req.customerPhone(), actor(jwt));
    }

    @PostMapping("/subscriptions/{subscriptionId}/payments/{paymentId}/refund")
    SubscriptionDetail refund(@PathVariable String salonId, @PathVariable Long subscriptionId,
                              @PathVariable Long paymentId, @RequestBody(required = false) RefundRequest req,
                              @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        return memberships.refundPayment(salonApi.resolveId(salonId), subscriptionId, paymentId,
                req == null ? null : req.amount(), req == null ? null : req.reason(), actor(jwt));
    }

    @PostMapping("/subscriptions/{subscriptionId}/notes")
    SubscriptionDetail addNote(@PathVariable String salonId, @PathVariable Long subscriptionId, @RequestBody NoteRequest req,
                               @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        return memberships.addNote(salonApi.resolveId(salonId), subscriptionId, req.note(), actor(jwt));
    }

    @PostMapping("/subscriptions/{subscriptionId}/resend-welcome")
    SubscriptionDetail resendWelcome(@PathVariable String salonId, @PathVariable Long subscriptionId) {
        return memberships.resendWelcome(salonApi.resolveId(salonId), subscriptionId);
    }

    /** Emails the member their renewal link now, instead of waiting for the reminder. */
    @PostMapping("/subscriptions/{subscriptionId}/send-renewal-link")
    SubscriptionDetail sendRenewalLink(@PathVariable String salonId, @PathVariable Long subscriptionId) {
        return memberships.sendRenewalLink(salonApi.resolveId(salonId), subscriptionId);
    }

    /**
     * Sell a membership at the salon desk. Cash/other activates it now ({@code checkoutUrl} is null);
     * card returns a Stripe Checkout URL to open on the desk, which comes back to {@code returnUrl}.
     */
    @PostMapping("/desk-sales")
    @ResponseStatus(HttpStatus.CREATED)
    CheckoutResult sellAtDesk(@PathVariable String salonId, @RequestBody DeskSaleSpec spec,
                              @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        return memberships.sellAtDesk(salonApi.resolveId(salonId), spec, jwt == null ? null : jwt.getSubject());
    }

    /** Look a member up by the code in their QR (scanned or typed). */
    @GetMapping("/verify")
    ResponseEntity<SubscriptionDetail> verify(@PathVariable String salonId, @RequestParam String code) {
        return ResponseEntity.of(memberships.verify(salonApi.resolveId(salonId), code));
    }

    @GetMapping("/overview")
    Overview overview(@PathVariable String salonId) {
        return memberships.overview(salonApi.resolveId(salonId));
    }
}
