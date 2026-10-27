package net.samitkumar.multi_tenant_salon.rating.internal;

import net.samitkumar.multi_tenant_salon.rating.RatingApi;
import net.samitkumar.multi_tenant_salon.rating.BookingRating;
import net.samitkumar.multi_tenant_salon.rating.CustomerRatingOption;
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
                  AND lower(b.customer_email) NOT LIKE '%@anonymized.invalid'
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
                  AND lower(b.customer_email) NOT LIKE '%@anonymized.invalid'
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

    @Override
    public java.util.List<BookingRating> getBookingRatings(UUID salonId, Long staffId) {
        var sql = """
                SELECT b.id AS booking_id,b.customer_name,si.name AS service_name,sm.name AS staff_name,
                       b.appointment_date,r.salon_rating,r.staff_rating,r.submitted_at
                FROM booking_review r
                JOIN booking b ON b.id=r.booking_id
                JOIN service_item si ON si.id=b.service_id
                JOIN staff_member sm ON sm.id=r.staff_id
                WHERE r.salon_id=:salonId
                """ + (staffId == null ? "" : " AND r.staff_id=:staffId ") + """
                ORDER BY r.submitted_at DESC,r.booking_id DESC LIMIT 500
                """;
        var query = jdbc.sql(sql).param("salonId", salonId);
        if (staffId != null) query = query.param("staffId", staffId);
        return query
                .query((rs, row) -> new BookingRating(rs.getLong("booking_id"), rs.getString("customer_name"),
                        rs.getString("service_name"), rs.getString("staff_name"), rs.getDate("appointment_date").toLocalDate(),
                        rs.getInt("salon_rating"), rs.getInt("staff_rating"), rs.getTimestamp("submitted_at").toInstant())).list();
    }

    @Override
    public java.util.List<CustomerRatingOption> getCustomerRatingOptions(UUID salonId, String customerEmail) {
        return jdbc.sql("""
                SELECT b.id,si.name service_name,sm.name staff_name,b.appointment_date,
                       EXISTS(SELECT 1 FROM booking_review r WHERE r.booking_id=b.id) submitted
                FROM booking b JOIN service_item si ON si.id=b.service_id JOIN staff_member sm ON sm.id=b.staff_id
                WHERE b.salon_id=:salonId AND lower(b.customer_email)=:email AND b.status='COMPLETED'
                ORDER BY b.appointment_date DESC,b.id DESC LIMIT 100
                """).param("salonId", salonId).param("email", customerEmail)
                .query((rs, row) -> new CustomerRatingOption(rs.getLong("id"), rs.getString("service_name"),
                        rs.getString("staff_name"), rs.getDate("appointment_date").toLocalDate(), rs.getBoolean("submitted"))).list();
    }

    @Override
    @Transactional
    public boolean submitCustomerReview(UUID salonId, String customerEmail, Long bookingId, int salonRating, int staffRating) {
        if (salonRating < 1 || salonRating > 5 || staffRating < 1 || staffRating > 5) return false;
        return jdbc.sql("""
                INSERT INTO booking_review (booking_id,salon_id,staff_id,salon_rating,staff_rating)
                SELECT b.id,b.salon_id,b.staff_id,:salonRating,:staffRating FROM booking b
                WHERE b.id=:bookingId AND b.salon_id=:salonId AND lower(b.customer_email)=:email AND b.status='COMPLETED'
                ON CONFLICT (booking_id) DO NOTHING
                """).param("bookingId", bookingId).param("salonId", salonId).param("email", customerEmail)
                .param("salonRating", salonRating).param("staffRating", staffRating).update() == 1;
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
