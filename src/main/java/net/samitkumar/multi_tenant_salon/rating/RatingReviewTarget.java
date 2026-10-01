package net.samitkumar.multi_tenant_salon.rating;

import java.time.Instant;
public record RatingReviewTarget(String salonName, String staffName, Instant expiresAt, boolean submitted) {}
