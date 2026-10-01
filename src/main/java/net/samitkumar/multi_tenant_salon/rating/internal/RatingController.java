package net.samitkumar.multi_tenant_salon.rating.internal;

import net.samitkumar.multi_tenant_salon.rating.RatingApi;
import net.samitkumar.multi_tenant_salon.rating.RatingReviewTarget;
import net.samitkumar.multi_tenant_salon.rating.SalonRatings;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
class RatingController {
    private final RatingApi ratings;
    private final SalonApi salons;

    RatingController(RatingApi ratings, SalonApi salons) {
        this.ratings = ratings;
        this.salons = salons;
    }

    record SubmitRatingRequest(int salonRating, int staffRating) {}

    @GetMapping("/api/public/rating/{token}")
    ResponseEntity<RatingReviewTarget> reviewTarget(@PathVariable String token) {
        var target = ratings.findReviewTarget(token);
        return target == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(target);
    }

    @PostMapping("/api/public/rating/{token}")
    ResponseEntity<Void> submit(@PathVariable String token, @RequestBody SubmitRatingRequest request) {
        return ratings.submitReview(token, request.salonRating(), request.staffRating())
                ? ResponseEntity.noContent().build() : ResponseEntity.badRequest().build();
    }

    @GetMapping("/api/salon/{salonId}/ratings")
    SalonRatings salonRatings(@PathVariable String salonId) {
        return ratings.getRatings(salons.resolveId(salonId));
    }
}
