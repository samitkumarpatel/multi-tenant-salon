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
    private static final int MAX_TEXT = 1000;
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
    public boolean submitReview(String token, Integer salonRating, Integer staffRating, String salonFeedback, String staffFeedback) {
        if (!validRating(salonRating) || !validRating(staffRating) || (salonRating == null && staffRating == null && cleanText(salonFeedback) == null && cleanText(staffFeedback) == null)) return false;
        String tokenHash = hash(token);
        return jdbc.sql("""
                INSERT INTO booking_review (booking_id, salon_id, staff_id, salon_rating, staff_rating, salon_feedback, staff_feedback, source)
                SELECT i.booking_id, i.salon_id, i.staff_id, :salonRating, :staffRating, :salonFeedback, :staffFeedback, 'NOTIFICATION'
                FROM rating_invitation i
                JOIN booking b ON b.id = i.booking_id AND b.status = 'COMPLETED'
                WHERE i.token_hash = :tokenHash AND i.expires_at > now()
                  AND lower(b.customer_email) NOT LIKE '%@anonymized.invalid'
                ON CONFLICT (booking_id) DO NOTHING
                """)
                .param("salonRating", salonRating).param("staffRating", staffRating).param("salonFeedback", cleanText(salonFeedback)).param("staffFeedback", cleanText(staffFeedback))
                .param("tokenHash", tokenHash).update() == 1;
    }

    @Override
    public SalonRatings getRatings(UUID salonId) {
        RatingSummary salon = jdbc.sql("""
                SELECT AVG(salon_rating)::double precision AS average, COUNT(salon_rating) AS count
                FROM (SELECT salon_rating,staff_rating,staff_id FROM booking_review WHERE salon_id=:salonId
                      UNION ALL SELECT salon_rating,staff_rating,staff_id FROM customer_feedback WHERE salon_id=:salonId) reviews
                """).param("salonId", salonId).query((rs, row) -> summary(rs.getObject("average", Double.class), rs.getLong("count"))).single();
        Map<Long, RatingSummary> staff = new HashMap<>();
        jdbc.sql("""
                SELECT staff_id, AVG(staff_rating)::double precision AS average, COUNT(staff_rating) AS count
                FROM (SELECT salon_rating,staff_rating,staff_id FROM booking_review WHERE salon_id=:salonId
                      UNION ALL SELECT salon_rating,staff_rating,staff_id FROM customer_feedback WHERE salon_id=:salonId) reviews WHERE staff_id IS NOT NULL AND staff_rating IS NOT NULL GROUP BY staff_id
                """).param("salonId", salonId).query((rs, row) -> {
                    staff.put(rs.getLong("staff_id"), summary(rs.getObject("average", Double.class), rs.getLong("count")));
                    return 1;
                }).list();
        return new SalonRatings(salon, Map.copyOf(staff));
    }

    @Override
    public java.util.List<BookingRating> getBookingRatings(UUID salonId, Long staffId) {
        var sql = """
                SELECT * FROM (
                    SELECT b.id AS booking_id,b.customer_name,si.name AS service_name,sm.name AS staff_name,
                           b.appointment_date,r.salon_rating,r.staff_rating,r.submitted_at,r.salon_feedback,r.staff_feedback,r.reply,r.replied_at,
                           NULL::bigint AS feedback_id,r.source,r.staff_id
                    FROM booking_review r
                    JOIN booking b ON b.id=r.booking_id
                    LEFT JOIN service_item si ON si.id=b.service_id
                    LEFT JOIN staff_member sm ON sm.id=r.staff_id
                    WHERE r.salon_id=:salonId
                    UNION ALL
                    SELECT NULL::bigint,f.customer_name,NULL::text,sm.name,NULL::date,
                           f.salon_rating,f.staff_rating,f.submitted_at,f.salon_feedback,f.staff_feedback,f.reply,f.replied_at,
                           f.id,f.source,f.staff_id
                    FROM customer_feedback f LEFT JOIN staff_member sm ON sm.id=f.staff_id
                    WHERE f.salon_id=:salonId
                ) reviews
                """ + (staffId == null ? "" : " WHERE staff_id=:staffId ") + " ORDER BY submitted_at DESC,booking_id DESC,feedback_id DESC";
        var query = jdbc.sql(sql).param("salonId", salonId);
        if (staffId != null) query = query.param("staffId", staffId);
        return query.query((rs, row) -> new BookingRating(rs.getObject("booking_id", Long.class), rs.getString("customer_name"),
                rs.getString("service_name"), rs.getString("staff_name"),
                rs.getDate("appointment_date") == null ? null : rs.getDate("appointment_date").toLocalDate(),
                rs.getObject("salon_rating", Integer.class), rs.getObject("staff_rating", Integer.class), rs.getTimestamp("submitted_at").toInstant(),
                rs.getString("salon_feedback"), rs.getString("staff_feedback"), rs.getString("reply"), instant(rs.getTimestamp("replied_at")),
                rs.getObject("feedback_id", Long.class), rs.getString("source"))).list();
    }

    @Override
    public java.util.List<CustomerRatingOption> getCustomerRatingOptions(UUID salonId, String customerEmail) {
        return jdbc.sql("""
                SELECT b.id,b.staff_id,si.name service_name,sm.name staff_name,b.appointment_date,
                       (r.booking_id IS NOT NULL) submitted,r.salon_feedback,r.staff_feedback,r.reply,r.replied_at
                FROM booking b JOIN service_item si ON si.id=b.service_id JOIN staff_member sm ON sm.id=b.staff_id
                LEFT JOIN booking_review r ON r.booking_id=b.id
                WHERE b.salon_id=:salonId AND lower(b.customer_email)=:email AND b.status='COMPLETED'
                ORDER BY b.appointment_date DESC,b.id DESC LIMIT 100
                """).param("salonId", salonId).param("email", customerEmail)
                .query((rs, row) -> new CustomerRatingOption(rs.getLong("id"), rs.getLong("staff_id"), rs.getString("service_name"),
                        rs.getString("staff_name"), rs.getDate("appointment_date").toLocalDate(), rs.getBoolean("submitted"),
                        rs.getString("salon_feedback"), rs.getString("staff_feedback"), rs.getString("reply"), instant(rs.getTimestamp("replied_at")))).list();
    }

    @Override
    @Transactional
    public boolean submitCustomerReview(UUID salonId, String customerEmail, Long bookingId, Integer salonRating, Integer staffRating, String salonFeedback, String staffFeedback) {
        if (!validRating(salonRating) || !validRating(staffRating) || (salonRating == null && staffRating == null && cleanText(salonFeedback) == null && cleanText(staffFeedback) == null)) return false;
        return jdbc.sql("""
                INSERT INTO booking_review (booking_id,salon_id,staff_id,salon_rating,staff_rating,salon_feedback,staff_feedback,source)
                SELECT b.id,b.salon_id,b.staff_id,:salonRating,:staffRating,:salonFeedback,:staffFeedback,'CUSTOMER_ACCOUNT' FROM booking b
                WHERE b.id=:bookingId AND b.salon_id=:salonId AND lower(b.customer_email)=:email AND b.status='COMPLETED'
                ON CONFLICT (booking_id) DO NOTHING
                """).param("bookingId", bookingId).param("salonId", salonId).param("email", customerEmail)
                .param("salonRating", salonRating).param("staffRating", staffRating).param("salonFeedback", cleanText(salonFeedback)).param("staffFeedback", cleanText(staffFeedback)).update() == 1;
    }

    @Override
    @Transactional
    public boolean replyToReview(UUID salonId, Long bookingId, String reply) {
        var text = cleanText(reply);
        if (text == null) return false;
        return jdbc.sql("UPDATE booking_review SET reply=:reply, replied_at=now() WHERE salon_id=:salonId AND booking_id=:bookingId")
                .param("reply", text).param("salonId", salonId).param("bookingId", bookingId).update() == 1;
    }

    static boolean validRating(Integer rating) { return rating == null || (rating >= 1 && rating <= 5); }

    /** Trims and caps free text; blank becomes null. */
    private static String cleanText(String text) {
        if (text == null || text.isBlank()) return null;
        var trimmed = text.strip();
        return trimmed.length() > MAX_TEXT ? trimmed.substring(0, MAX_TEXT) : trimmed;
    }

    private static Instant instant(java.sql.Timestamp ts) {
        return ts == null ? null : ts.toInstant();
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
