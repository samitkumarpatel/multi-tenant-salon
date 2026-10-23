package net.samitkumar.multi_tenant_salon.payments.internal;

import net.samitkumar.multi_tenant_salon.payments.CheckoutUi;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * The {@code payment} / {@code payment_refund} tables: every attempt to take money, whichever module asked
 * for it. Status only ever moves out of {@code PENDING} through a conditional {@code UPDATE}, so webhook
 * redelivery, status polling and a desk cancel racing each other settle a payment exactly once.
 */
@Component
class PaymentLedger {

    enum Channel { CHECKOUT, TERMINAL }

    record PaymentRecord(Long id, UUID salonId, String area, String reference, Channel channel, CheckoutUi checkoutUi,
                         String status, BigDecimal amount, String currency, BigDecimal amountRefunded,
                         String description, String customerEmail, String checkoutSessionId,
                         String paymentIntentId, Long terminalId, String failureMessage,
                         Instant createdAt, Instant updatedAt) {
        boolean pending() { return "PENDING".equals(status); }
        boolean refundable() {
            return ("SUCCEEDED".equals(status) || "PARTIALLY_REFUNDED".equals(status)) && paymentIntentId != null;
        }
        BigDecimal remaining() { return amount.subtract(amountRefunded); }
    }

    record RefundRecord(Long id, Long paymentId, UUID salonId, String stripeRefundId, BigDecimal amount,
                        String currency, String status, String reason, String requestedBy, Instant createdAt) {}

    private static final String COLUMNS = "id, salon_id, area, reference, channel, checkout_ui, status, amount, currency, "
            + "amount_refunded, description, customer_email, checkout_session_id, payment_intent_id, terminal_id, "
            + "failure_message, created_at, updated_at";

    private final JdbcClient jdbc;

    PaymentLedger(JdbcTemplate jdbcTemplate) {
        this.jdbc = JdbcClient.create(jdbcTemplate);
    }

    /** Idempotent per session: a replayed Checkout create (same idempotency key) returns the same session. */
    PaymentRecord recordCheckout(UUID salonId, String area, String reference, CheckoutUi ui, BigDecimal amount,
                                 String currency, String description, String customerEmail, String sessionId) {
        var now = ts(Instant.now());
        jdbc.sql("""
                INSERT INTO payment (salon_id, area, reference, channel, checkout_ui, status, amount, currency,
                    description, customer_email, checkout_session_id, created_at, updated_at)
                VALUES (:salon, :area, :reference, 'CHECKOUT', :ui, 'PENDING', :amount, :currency,
                    :description, :email, :session, :now, :now)
                ON CONFLICT (checkout_session_id) DO NOTHING
                """)
                .param("salon", salonId).param("area", area).param("reference", reference).param("ui", ui.name())
                .param("amount", amount).param("currency", currency.toUpperCase(java.util.Locale.ROOT))
                .param("description", truncate(description, 255)).param("email", truncate(customerEmail, 255))
                .param("session", sessionId).param("now", now).update();
        return findBySession(sessionId).orElseThrow();
    }

    PaymentRecord recordTerminal(UUID salonId, String area, String reference, BigDecimal amount, String currency,
                                 String description, String paymentIntentId, Long terminalId) {
        var now = ts(Instant.now());
        jdbc.sql("""
                INSERT INTO payment (salon_id, area, reference, channel, status, amount, currency, description,
                    payment_intent_id, terminal_id, created_at, updated_at)
                VALUES (:salon, :area, :reference, 'TERMINAL', 'PENDING', :amount, :currency, :description,
                    :intent, :terminal, :now, :now)
                ON CONFLICT (payment_intent_id) DO NOTHING
                """)
                .param("salon", salonId).param("area", area).param("reference", reference)
                .param("amount", amount).param("currency", currency.toUpperCase(java.util.Locale.ROOT))
                .param("description", truncate(description, 255)).param("intent", paymentIntentId)
                .param("terminal", terminalId).param("now", now).update();
        return findByIntent(paymentIntentId).orElseThrow();
    }

    Optional<PaymentRecord> find(UUID salonId, Long id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM payment WHERE id = :id AND salon_id = :salon")
                .param("id", id).param("salon", salonId).query(PaymentLedger::payment).optional();
    }

    Optional<PaymentRecord> findBySession(String sessionId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM payment WHERE checkout_session_id = :session")
                .param("session", sessionId).query(PaymentLedger::payment).optional();
    }

    Optional<PaymentRecord> findByIntent(String paymentIntentId) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM payment WHERE payment_intent_id = :intent")
                .param("intent", paymentIntentId).query(PaymentLedger::payment).optional();
    }

    /** The latest card payment that went through for {@code area}/{@code reference}, locked for a refund. */
    Optional<PaymentRecord> lockLatestPaid(UUID salonId, String area, String reference) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM payment WHERE salon_id = :salon AND area = :area AND reference = :reference"
                        + " AND status IN ('SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED') ORDER BY created_at DESC LIMIT 1 FOR UPDATE")
                .param("salon", salonId).param("area", area).param("reference", reference)
                .query(PaymentLedger::payment).optional();
    }

    Optional<PaymentRecord> lock(UUID salonId, Long id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM payment WHERE id = :id AND salon_id = :salon FOR UPDATE")
                .param("id", id).param("salon", salonId).query(PaymentLedger::payment).optional();
    }

    /** Newest first; {@code reference} narrows to the attempts for one order / payment / sale in {@code area}. */
    List<PaymentRecord> list(UUID salonId, String area, String reference, int limit) {
        var sql = "SELECT " + COLUMNS + " FROM payment WHERE salon_id = :salon"
                + (area == null ? "" : " AND area = :area")
                + (reference == null ? "" : " AND reference = :reference")
                + " ORDER BY created_at DESC, id DESC LIMIT :limit";
        var spec = jdbc.sql(sql).param("salon", salonId).param("limit", limit);
        if (area != null) spec = spec.param("area", area);
        if (reference != null) spec = spec.param("reference", reference);
        return spec.query(PaymentLedger::payment).list();
    }

    /**
     * Moves a {@code PENDING} payment to its outcome; true only for the call that actually moved it, which is
     * the one that must tell the feature module.
     */
    boolean settle(Long id, String status, String paymentIntentId, String failureMessage) {
        return jdbc.sql("""
                UPDATE payment SET status = :status,
                    payment_intent_id = COALESCE(payment_intent_id, :intent),
                    failure_message = COALESCE(:failure, failure_message), updated_at = :now
                WHERE id = :id AND status = 'PENDING'
                """)
                .param("status", status).param("intent", paymentIntentId).param("failure", truncate(failureMessage, 500))
                .param("now", ts(Instant.now())).param("id", id).update() == 1;
    }

    /** A reader declined or lost the card: the payment stays open so the desk can retry or cancel it. */
    void noteFailure(Long id, String failureMessage) {
        jdbc.sql("UPDATE payment SET failure_message = :failure, updated_at = :now WHERE id = :id AND status = 'PENDING'")
                .param("failure", truncate(failureMessage, 500)).param("now", ts(Instant.now())).param("id", id).update();
    }

    void retarget(Long id, Long terminalId) {
        jdbc.sql("UPDATE payment SET terminal_id = :terminal, failure_message = NULL, updated_at = :now WHERE id = :id AND status = 'PENDING'")
                .param("terminal", terminalId).param("now", ts(Instant.now())).param("id", id).update();
    }

    // ── Refunds ─────────────────────────────────────────────────────────────

    RefundRecord recordRefund(PaymentRecord payment, String stripeRefundId, BigDecimal amount, String status,
                              String reason, String requestedBy) {
        var now = ts(Instant.now());
        jdbc.sql("""
                INSERT INTO payment_refund (payment_id, salon_id, stripe_refund_id, amount, currency, status, reason,
                    requested_by, created_at, updated_at)
                VALUES (:payment, :salon, :refund, :amount, :currency, :status, :reason, :by, :now, :now)
                ON CONFLICT (stripe_refund_id) DO NOTHING
                """)
                .param("payment", payment.id()).param("salon", payment.salonId()).param("refund", stripeRefundId)
                .param("amount", amount).param("currency", payment.currency()).param("status", status)
                .param("reason", truncate(reason, 500)).param("by", truncate(requestedBy, 255)).param("now", now).update();
        recomputeRefunded(payment.id());
        return findRefund(stripeRefundId).orElseThrow();
    }

    Optional<RefundRecord> findRefund(String stripeRefundId) {
        return jdbc.sql("SELECT id, payment_id, salon_id, stripe_refund_id, amount, currency, status, reason, requested_by, created_at"
                        + " FROM payment_refund WHERE stripe_refund_id = :refund")
                .param("refund", stripeRefundId).query(PaymentLedger::refund).optional();
    }

    List<RefundRecord> refunds(UUID salonId, Long paymentId) {
        return jdbc.sql("SELECT id, payment_id, salon_id, stripe_refund_id, amount, currency, status, reason, requested_by, created_at"
                        + " FROM payment_refund WHERE salon_id = :salon AND payment_id = :payment ORDER BY created_at, id")
                .param("salon", salonId).param("payment", paymentId).query(PaymentLedger::refund).list();
    }

    /** Applies Stripe's latest status for a refund (from a webhook) and rebalances its payment. */
    void updateRefundStatus(String stripeRefundId, String status) {
        var refund = findRefund(stripeRefundId).orElse(null);
        if (refund == null || refund.status().equals(status)) return;
        jdbc.sql("UPDATE payment_refund SET status = :status, updated_at = :now WHERE stripe_refund_id = :refund")
                .param("status", status).param("now", ts(Instant.now())).param("refund", stripeRefundId).update();
        recomputeRefunded(refund.paymentId());
    }

    /** Refunds that failed or were canceled give the money back to the payment's refundable balance. */
    private void recomputeRefunded(Long paymentId) {
        jdbc.sql("""
                UPDATE payment p SET amount_refunded = r.total, updated_at = :now,
                    status = CASE
                        WHEN p.status NOT IN ('SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED') THEN p.status
                        WHEN r.total <= 0 THEN 'SUCCEEDED'
                        WHEN r.total >= p.amount THEN 'REFUNDED'
                        ELSE 'PARTIALLY_REFUNDED' END
                FROM (SELECT COALESCE(SUM(amount), 0) AS total FROM payment_refund
                      WHERE payment_id = :id AND status NOT IN ('failed', 'canceled')) r
                WHERE p.id = :id
                """)
                .param("now", ts(Instant.now())).param("id", paymentId).update();
    }

    private static PaymentRecord payment(ResultSet rs, int row) throws SQLException {
        var ui = rs.getString("checkout_ui");
        return new PaymentRecord(rs.getLong("id"), rs.getObject("salon_id", UUID.class), rs.getString("area"),
                rs.getString("reference"), Channel.valueOf(rs.getString("channel")),
                ui == null ? null : CheckoutUi.valueOf(ui), rs.getString("status"), rs.getBigDecimal("amount"),
                rs.getString("currency"), rs.getBigDecimal("amount_refunded"), rs.getString("description"),
                rs.getString("customer_email"), rs.getString("checkout_session_id"), rs.getString("payment_intent_id"),
                (Long) rs.getObject("terminal_id", Long.class), rs.getString("failure_message"),
                instant(rs, "created_at"), instant(rs, "updated_at"));
    }

    private static RefundRecord refund(ResultSet rs, int row) throws SQLException {
        return new RefundRecord(rs.getLong("id"), rs.getLong("payment_id"), rs.getObject("salon_id", UUID.class),
                rs.getString("stripe_refund_id"), rs.getBigDecimal("amount"), rs.getString("currency"),
                rs.getString("status"), rs.getString("reason"), rs.getString("requested_by"), instant(rs, "created_at"));
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        var value = rs.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    /** pgjdbc can't infer a SQL type for java.time.Instant through JdbcClient; OffsetDateTime maps to timestamptz. */
    private static OffsetDateTime ts(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }
}
