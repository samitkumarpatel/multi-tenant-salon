package net.samitkumar.multi_tenant_salon.rating.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;

/** Moderation changes only public text visibility; consent and scores cannot be changed by the owner. */
@RestController
class ReviewVisibilityController {
    private final JdbcClient jdbc;
    private final SalonApi salons;

    ReviewVisibilityController(JdbcClient jdbc, SalonApi salons) {
        this.jdbc = jdbc;
        this.salons = salons;
    }

    record Visibility(@NotNull Boolean hidden) {}

    @PutMapping("/api/salon-admin/{salonId}/{kind:ratings|feedback}/{reviewId}/visibility")
    ResponseEntity<Void> visibility(@PathVariable String salonId, @PathVariable String kind,
                                    @PathVariable long reviewId, @Valid @RequestBody Visibility body) {
        // Fixed identifiers only, never SQL supplied by the request.
        String table = kind.equals("ratings") ? "booking_review" : "customer_feedback";
        String key = kind.equals("ratings") ? "booking_id" : "id";
        int updated = jdbc.sql("UPDATE " + table + " SET public_hidden=:hidden WHERE salon_id=:salon AND " + key + "=:review AND public_consent=true")
                .param("hidden", body.hidden()).param("salon", salons.resolveId(salonId)).param("review", reviewId).update();
        return updated == 1 ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
