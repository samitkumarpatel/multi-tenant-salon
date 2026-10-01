package net.samitkumar.multi_tenant_salon.rating.internal;

import net.samitkumar.multi_tenant_salon.rating.RatingApi;
import net.samitkumar.multi_tenant_salon.rating.RatingReviewTarget;
import net.samitkumar.multi_tenant_salon.rating.RatingSummary;
import net.samitkumar.multi_tenant_salon.rating.SalonRatings;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
class RatingService implements RatingApi {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32;
    private final JdbcClient jdbc;

    RatingService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional
    public String issueInvitation(Long bookingId, UUID salonId, Long staffId) {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String hash = hash(token);
        Instant expiresAt = Instant.now().plus(30, ChronoUnit.DAYS);
        int inserted = jdbc.sql("""
                INSERT INTO rating_invitation (booking_id, salon_id, staff_id, token_hash, expires_at)
                VALUES (:bookingId, :salonId, :staffId, :tokenHash, :expiresAt)
                ON CONFLICT (booking_id) DO UPDATE SET token_hash = EXCLUDED.token_hash,
                    expires_at = EXCLUDED.expires_at
                WHERE NOT EXISTS (SELECT 1 FROM booking_review WHERE booking_id = :bookingId)
                """)
                .param("bookingId", bookingId).param("salonId", salonId).param("staffId", staffId)
                .param("tokenHash", hash).param("expiresAt", java.time.OffsetDateTime.ofInstant(expiresAt, java.time.ZoneOffset.UTC)).update();
        return inserted == 1 ? token : null;
    }

    @Override
    public RatingReviewTarget findReviewTarget(String token) {
        String tokenHash = hash(token);
        return jdbc.sql("""
                SELECT s.name AS salon_name, sm.name AS staff_name, i.expires_at,
                       EXISTS (SELECT 1 FROM booking_review r WHERE r.booking_id = i.booking_id) AS submitted
                FROM rating_invitation i
                JOIN booking b ON b.id = i.booking_id AND b.status = 'COMPLETED'
                JOIN salon s ON s.id = i.salon_id
                JOIN staff_member sm ON sm.id = i.staff_id
                WHERE i.token_hash = :tokenHash AND i.expires_at > now()
                """)
                .param("tokenHash", tokenHash)
                .query((rs, row) -> new RatingReviewTarget(rs.getString("salon_name"), rs.getString("staff_name"),
                        rs.getTimestamp("expires_at").toInstant(), rs.getBoolean("submitted")))
                .optional().orElse(null);
    }

    @Override
    @Transactional
    public boolean submitReview(String token, int salonRating, int staffRating) {
        if (salonRating < 1 || salonRating > 5 || staffRating < 1 || staffRating > 5) return false;
        String tokenHash = hash(token);
        return jdbc.sql("""
                INSERT INTO booking_review (booking_id, salon_id, staff_id, salon_rating, staff_rating)
                SELECT i.booking_id, i.salon_id, i.staff_id, :salonRating, :staffRating
                FROM rating_invitation i
                JOIN booking b ON b.id = i.booking_id AND b.status = 'COMPLETED'
                WHERE i.token_hash = :tokenHash AND i.expires_at > now()
                ON CONFLICT (booking_id) DO NOTHING
                """)
                .param("salonRating", salonRating).param("staffRating", staffRating)
                .param("tokenHash", tokenHash).update() == 1;
    }

    @Override
    public SalonRatings getRatings(UUID salonId) {
        RatingSummary salon = jdbc.sql("""
                SELECT AVG(salon_rating)::double precision AS average, COUNT(*) AS count
                FROM booking_review WHERE salon_id = :salonId
                """).param("salonId", salonId).query((rs, row) -> summary(rs.getObject("average", Double.class), rs.getLong("count"))).single();
        Map<Long, RatingSummary> staff = new HashMap<>();
        jdbc.sql("""
                SELECT staff_id, AVG(staff_rating)::double precision AS average, COUNT(*) AS count
                FROM booking_review WHERE salon_id = :salonId GROUP BY staff_id
                """).param("salonId", salonId).query((rs, row) -> {
                    staff.put(rs.getLong("staff_id"), summary(rs.getObject("average", Double.class), rs.getLong("count")));
                    return 1;
                }).list();
        return new SalonRatings(salon, Map.copyOf(staff));
    }

    private static RatingSummary summary(Double average, long count) {
        return new RatingSummary(average == null ? null : Math.round(average * 10.0) / 10.0, count);
    }

    private static String hash(String token) {
        try {
            return Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
