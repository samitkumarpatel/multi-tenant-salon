package net.samitkumar.multi_tenant_salon.rating;

import java.util.Map;

public record SalonRatings(RatingSummary salon, Map<Long, RatingSummary> staff) {}
