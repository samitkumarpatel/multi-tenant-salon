package net.samitkumar.multi_tenant_salon.loyalty.internal;

import net.samitkumar.multi_tenant_salon.loyalty.CustomerLoyalty.Program;
import net.samitkumar.multi_tenant_salon.loyalty.CustomerLoyalty.Reward;
import net.samitkumar.multi_tenant_salon.loyalty.internal.LoyaltyService.*;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;

/**
 * Owner surface for the loyalty programme — {@code /api/salon-admin/{salonId}/loyalty/**}. The desk
 * (active staff) may read members and redemptions and hand over a code ({@code SalonDeskAccess});
 * settings, rewards, adjustments and cancelling a redemption stay with the owner.
 */
@RestController
@RequestMapping("/api/salon-admin/{salonId}/loyalty")
class LoyaltyAdminController {
    private final LoyaltyService loyalty;
    private final SalonApi salons;

    LoyaltyAdminController(LoyaltyService loyalty, SalonApi salons) {
        this.loyalty = loyalty;
        this.salons = salons;
    }

    record AdjustRequest(String email, int points, String note) {}

    private static String actor(Jwt jwt) {
        return jwt == null || jwt.getSubject() == null ? "admin" : jwt.getSubject();
    }

    @GetMapping
    Overview overview(@PathVariable String salonId) {
        return loyalty.overview(salons.resolveId(salonId));
    }

    @PutMapping("/program")
    Program saveProgram(@PathVariable String salonId, @RequestBody ProgramSpec spec) {
        return loyalty.saveProgram(salons.resolveId(salonId), spec);
    }

    @GetMapping("/rewards")
    List<Reward> rewards(@PathVariable String salonId) {
        return loyalty.rewards(salons.resolveId(salonId), false);
    }

    @PostMapping("/rewards")
    ResponseEntity<Reward> createReward(@PathVariable String salonId, @RequestBody RewardSpec spec) {
        var reward = loyalty.createReward(salons.resolveId(salonId), spec);
        var location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(reward.id()).toUri();
        return ResponseEntity.created(location).body(reward);
    }

    @PutMapping("/rewards/{rewardId}")
    ResponseEntity<Reward> updateReward(@PathVariable String salonId, @PathVariable Long rewardId, @RequestBody RewardSpec spec) {
        return ResponseEntity.of(loyalty.updateReward(salons.resolveId(salonId), rewardId, spec));
    }

    @DeleteMapping("/rewards/{rewardId}")
    ResponseEntity<Void> deleteReward(@PathVariable String salonId, @PathVariable Long rewardId) {
        return loyalty.deleteReward(salons.resolveId(salonId), rewardId) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    @GetMapping("/members")
    List<MemberSummary> members(@PathVariable String salonId, @RequestParam(required = false) String q) {
        return loyalty.members(salons.resolveId(salonId), q);
    }

    /** One customer's balance, history and codes. The email is a query parameter, not a path segment, so dots and plus signs survive. */
    @GetMapping("/member")
    MemberDetail member(@PathVariable String salonId, @RequestParam String email) {
        return loyalty.member(salons.resolveId(salonId), email);
    }

    @PostMapping("/adjustments")
    MemberDetail adjust(@PathVariable String salonId, @RequestBody AdjustRequest request, @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        return loyalty.adjust(salons.resolveId(salonId), request.email(), request.points(), request.note(), actor(jwt));
    }

    @GetMapping("/redemptions")
    List<AdminRedemption> redemptions(@PathVariable String salonId, @RequestParam(required = false) String status) {
        return loyalty.listRedemptions(salons.resolveId(salonId), status);
    }

    @GetMapping("/redemptions/by-code/{code}")
    ResponseEntity<AdminRedemption> byCode(@PathVariable String salonId, @PathVariable String code) {
        return ResponseEntity.of(loyalty.redemptionByCode(salons.resolveId(salonId), code));
    }

    @PostMapping("/redemptions/{id}/use")
    AdminRedemption use(@PathVariable String salonId, @PathVariable Long id, @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        return loyalty.markUsed(salons.resolveId(salonId), id, actor(jwt));
    }

    @PostMapping("/redemptions/{id}/cancel")
    AdminRedemption cancel(@PathVariable String salonId, @PathVariable Long id, @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        return loyalty.cancel(salons.resolveId(salonId), id, actor(jwt));
    }
}
