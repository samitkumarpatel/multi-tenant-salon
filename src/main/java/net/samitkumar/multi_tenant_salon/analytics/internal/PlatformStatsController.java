package net.samitkumar.multi_tenant_salon.analytics.internal;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/** Public, aggregate-only platform totals for the onboarding page. */
@RestController
class PlatformStatsController {
    private final JdbcClient jdbc;

    PlatformStatsController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    record PlatformStats(long salonsOnboarded, long bookingsCreated, long countriesRepresented) {}

    @GetMapping("/api/salon-onboarding/stats")
    ResponseEntity<PlatformStats> stats() {
        // Lifetime registered salons and bookings (including cancelled bookings).
        // Blank countries are excluded and case and surrounding whitespace are normalised.
        var stats = jdbc.sql("""
                SELECT (SELECT COUNT(*) FROM salon) AS salons_onboarded,
                       (SELECT COUNT(*) FROM booking) AS bookings_created,
                       (SELECT COUNT(DISTINCT LOWER(TRIM(country))) FROM salon
                        WHERE NULLIF(TRIM(country), '') IS NOT NULL) AS countries_represented
                """).query(PlatformStats.class).single();
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(stats);
    }
}
