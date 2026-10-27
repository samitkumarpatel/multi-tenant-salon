package net.samitkumar.multi_tenant_salon.booking.internal;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * The payment links a salon sends for appointments, kept so the admin and the desk can see what is outstanding and
 * follow up. The money itself lives in the payment ledger; this is the salon's own record of the link: what it asked
 * for, who sent it, whether it was emailed, and whether it is still open.
 *
 * <p>Statuses: {@code OPEN} until Stripe reports an outcome, {@code PAID}, {@code EXPIRED} (expired or failed, and
 * also what an {@code OPEN} link reads as once its 24 hours are up), {@code SUPERSEDED} (a newer link replaced it).
 */
@Service
class BookingPaymentLinks {
    /** Stripe keeps a hosted checkout page open for 24 hours. */
    static final Duration LIFETIME = Duration.ofHours(24);
    /** Guards against a double click sending the same email twice. */
    static final Duration MIN_RESEND_GAP = Duration.ofMinutes(1);

    record Link(Long id, Long bookingId, String status, BigDecimal amount, String currency, String url, String createdBy,
                Instant createdAt, Instant expiresAt, Instant paidAt, String emailedTo, Instant lastEmailedAt, int emailCount) {}

    /** A link with the appointment it is for: one row of the salon's "waiting for payment" list. */
    record FollowUp(Link link, String customerName, String customerEmail, String serviceName, LocalDate appointmentDate,
                    String bookingStatus) {}

    /** What {@link #settle} found, so the booking knows whether an outcome concerns its current link. */
    record Settlement(boolean known, boolean current) {}

    private static final String COLUMNS = """
            l.id, l.booking_id, l.amount, l.currency, l.url, l.created_by, l.created_at, l.expires_at, l.paid_at,
            l.emailed_to, l.last_emailed_at, l.email_count,
            CASE WHEN l.status = 'OPEN' AND l.expires_at <= now() THEN 'EXPIRED' ELSE l.status END AS shown""";

    private final JdbcClient jdbc;

    BookingPaymentLinks(JdbcClient jdbc) { this.jdbc = jdbc; }

    /**
     * Records a new link and retires the appointment's earlier open ones, so only one is ever live.
     *
     * @return the Stripe sessions of the links it replaced, for the caller to expire at Stripe
     */
    @Transactional
    List<String> record(UUID salonId, Long bookingId, String sessionId, String url, BigDecimal amount, String currency, String createdBy) {
        var replaced = jdbc.sql("""
                UPDATE booking_payment_link SET status = 'SUPERSEDED'
                WHERE salon_id = :salon AND booking_id = :booking AND status = 'OPEN' AND checkout_session_id <> :session
                RETURNING checkout_session_id
                """).param("salon", salonId).param("booking", bookingId).param("session", sessionId)
                .query(String.class).list();
        jdbc.sql("""
                INSERT INTO booking_payment_link (salon_id, booking_id, checkout_session_id, url, amount, currency, created_by, expires_at)
                VALUES (:salon, :booking, :session, :url, :amount, :currency, :by, :expires)
                ON CONFLICT (checkout_session_id) DO NOTHING
                """).param("salon", salonId).param("booking", bookingId).param("session", sessionId).param("url", url)
                .param("amount", amount).param("currency", currency).param("by", createdBy)
                .param("expires", OffsetDateTime.ofInstant(Instant.now().plus(LIFETIME), ZoneOffset.UTC)).update();
        return replaced;
    }

    Optional<Link> bySession(UUID salonId, String sessionId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM booking_payment_link l WHERE l.salon_id = :salon AND l.checkout_session_id = :session")
                .param("salon", salonId).param("session", sessionId).query(BookingPaymentLinks::link).optional();
    }

    Optional<Link> find(UUID salonId, Long bookingId, Long linkId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM booking_payment_link l WHERE l.salon_id = :salon AND l.booking_id = :booking AND l.id = :id")
                .param("salon", salonId).param("booking", bookingId).param("id", linkId).query(BookingPaymentLinks::link).optional();
    }

    /** Every link for one appointment, newest first. */
    List<Link> forBooking(UUID salonId, Long bookingId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM booking_payment_link l WHERE l.salon_id = :salon AND l.booking_id = :booking ORDER BY l.created_at DESC, l.id DESC")
                .param("salon", salonId).param("booking", bookingId).query(BookingPaymentLinks::link).list();
    }

    /**
     * The latest link of each appointment, newest first. {@code status} is {@code OPEN}, {@code EXPIRED}, {@code PAID}
     * or {@code ALL}; "expired" includes open links whose time has run out.
     */
    List<FollowUp> followUps(UUID salonId, String status, int limit) {
        return jdbc.sql("""
                SELECT * FROM (
                    SELECT DISTINCT ON (l.booking_id) %s, b.customer_name, b.customer_email, b.appointment_date,
                           b.status AS booking_status, si.name AS service_name
                    FROM booking_payment_link l
                    JOIN booking b ON b.id = l.booking_id
                    JOIN service_item si ON si.id = b.service_id
                    WHERE l.salon_id = :salon
                    ORDER BY l.booking_id, l.created_at DESC, l.id DESC) latest
                WHERE :status = 'ALL' OR shown = :status
                ORDER BY created_at DESC, id DESC LIMIT :limit
                """.formatted(COLUMNS)).param("salon", salonId).param("status", status).param("limit", Math.clamp(limit, 1, 500))
                .query((rs, row) -> new FollowUp(link(rs, row), rs.getString("customer_name"), rs.getString("customer_email"),
                        rs.getString("service_name"), rs.getDate("appointment_date").toLocalDate(), rs.getString("booking_status")))
                .list();
    }

    @Transactional
    void markEmailed(UUID salonId, Long linkId, String to) {
        jdbc.sql("UPDATE booking_payment_link SET emailed_to = :to, last_emailed_at = now(), email_count = email_count + 1 WHERE id = :id AND salon_id = :salon")
                .param("to", to).param("id", linkId).param("salon", salonId).update();
    }

    /**
     * Applies Stripe's outcome for {@code sessionId}. Paid is paid, whichever link it was; a failure or expiry only
     * closes a link that is still open. {@code current} is false for a superseded link, whose ending says nothing
     * about the appointment because a newer link is the one the customer is meant to use.
     */
    @Transactional
    Settlement settle(UUID salonId, String sessionId, boolean succeeded) {
        var existing = jdbc.sql("SELECT status FROM booking_payment_link WHERE salon_id = :salon AND checkout_session_id = :session")
                .param("salon", salonId).param("session", sessionId).query(String.class).optional();
        if (existing.isEmpty()) return new Settlement(false, true);
        if (succeeded) {
            jdbc.sql("UPDATE booking_payment_link SET status = 'PAID', paid_at = COALESCE(paid_at, now()) WHERE salon_id = :salon AND checkout_session_id = :session AND status <> 'PAID'")
                    .param("salon", salonId).param("session", sessionId).update();
            return new Settlement(true, true);
        }
        jdbc.sql("UPDATE booking_payment_link SET status = 'EXPIRED' WHERE salon_id = :salon AND checkout_session_id = :session AND status = 'OPEN'")
                .param("salon", salonId).param("session", sessionId).update();
        return new Settlement(true, !"SUPERSEDED".equals(existing.get()));
    }

    private static Link link(ResultSet rs, int row) throws SQLException {
        return new Link(rs.getLong("id"), rs.getLong("booking_id"), rs.getString("shown"), rs.getBigDecimal("amount"),
                rs.getString("currency"), rs.getString("url"), rs.getString("created_by"), instant(rs.getTimestamp("created_at")),
                instant(rs.getTimestamp("expires_at")), instant(rs.getTimestamp("paid_at")), rs.getString("emailed_to"),
                instant(rs.getTimestamp("last_emailed_at")), rs.getInt("email_count"));
    }

    private static Instant instant(Timestamp ts) { return ts == null ? null : ts.toInstant(); }
}
