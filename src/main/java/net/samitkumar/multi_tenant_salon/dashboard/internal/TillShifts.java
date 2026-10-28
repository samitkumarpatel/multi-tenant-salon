package net.samitkumar.multi_tenant_salon.dashboard.internal;

import net.samitkumar.multi_tenant_salon.membership.MembershipApi;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * The cash drawer's shifts. A shift opens with a float and closes with the counted cash; what the drawer
 * should hold is the float plus the cash taken since it opened (till sales and memberships sold for cash).
 * The expected figure is frozen at close so the difference can't drift afterwards.
 */
@Service
class TillShifts {
    private static final BigDecimal MAX_AMOUNT = new BigDecimal("1000000");

    record Shift(Long id, String currency, BigDecimal openingFloat, String openedBy, Instant openedAt, String closedBy, Instant closedAt,
                 BigDecimal countedCash, BigDecimal expectedCash, BigDecimal difference, String note) {}

    private final JdbcClient jdbc;
    private final DashboardManager dashboard;
    private final ObjectProvider<MembershipApi> memberships;

    TillShifts(JdbcTemplate jdbcTemplate, DashboardManager dashboard, ObjectProvider<MembershipApi> memberships) {
        this.jdbc = JdbcClient.create(jdbcTemplate);
        this.dashboard = dashboard;
        this.memberships = memberships;
    }

    /** The salon's open shift with the cash it should hold right now, if one is open. */
    Optional<Shift> current(UUID salonId) {
        requireCashier(salonId);
        return find("closed_at IS NULL", salonId).map(open -> withExpected(salonId, open, Instant.now()));
    }

    /** Recent shifts, newest first. */
    List<Shift> recent(UUID salonId) {
        requireCashier(salonId);
        return jdbc.sql(SELECT + " WHERE salon_id = :salon ORDER BY opened_at DESC, id DESC LIMIT 30").param("salon", salonId)
                .query(TillShifts::shift).list().stream()
                .map(s -> s.closedAt() == null ? withExpected(salonId, s, Instant.now()) : s).toList();
    }

    @Transactional
    Shift open(UUID salonId, BigDecimal openingFloat, String currency, String actor) {
        requireCashier(salonId);
        var amount = money(openingFloat, "The opening float");
        if (currency == null || !currency.strip().matches("[A-Za-z]{3}")) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A 3-letter currency is required");
        try {
            var id = jdbc.sql("INSERT INTO till_shift (salon_id, currency, opening_float, opened_by) VALUES (:salon, :currency, :float, :by) RETURNING id")
                    .param("salon", salonId).param("currency", currency.strip().toUpperCase()).param("float", amount).param("by", actor)
                    .query(Long.class).single();
            return find("id = " + id, salonId).orElseThrow();
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A shift is already open — close it first");
        }
    }

    @Transactional
    Shift close(UUID salonId, BigDecimal countedCash, String note, String actor) {
        requireCashier(salonId);
        var counted = money(countedCash, "The counted cash");
        var open = find("closed_at IS NULL", salonId).orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "No shift is open"));
        var now = Instant.now();
        var expected = withExpected(salonId, open, now).expectedCash();
        int closed = jdbc.sql("""
                UPDATE till_shift SET closed_at = :at, closed_by = :by, counted_cash = :counted, expected_cash = :expected, note = :note
                WHERE id = :id AND salon_id = :salon AND closed_at IS NULL""")
                .param("at", OffsetDateTime.ofInstant(now, ZoneOffset.UTC)).param("by", actor).param("counted", counted).param("expected", expected)
                .param("note", note == null || note.isBlank() ? null : note.strip()).param("id", open.id()).param("salon", salonId).update();
        if (closed != 1) throw new ResponseStatusException(HttpStatus.CONFLICT, "This shift was already closed");
        return find("id = " + open.id(), salonId).orElseThrow();
    }

    private void requireCashier(UUID salonId) {
        if (!dashboard.settings(salonId).cashierEnabled()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cashier is disabled");
    }

    private static BigDecimal money(BigDecimal value, String what) {
        if (value == null || value.signum() < 0 || value.compareTo(MAX_AMOUNT) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, what + " must be between 0 and " + MAX_AMOUNT.toPlainString());
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    /** Float + cash sales in the shift's currency since it opened + cash memberships − cash refunded on memberships. */
    private Shift withExpected(UUID salonId, Shift shift, Instant until) {
        var from = OffsetDateTime.ofInstant(shift.openedAt(), ZoneOffset.UTC);
        var to = OffsetDateTime.ofInstant(until, ZoneOffset.UTC);
        var cash = jdbc.sql("""
                SELECT COALESCE(sum(total), 0) FROM pos_sale
                WHERE salon_id = :salon AND currency = :currency AND payment_method = 'CASH' AND payment_status = 'PAID'
                  AND voided_at IS NULL AND created_at >= :from AND created_at <= :to""")
                .param("salon", salonId).param("currency", shift.currency()).param("from", from).param("to", to)
                .query(BigDecimal.class).single();
        var api = memberships.getIfAvailable();
        if (api != null) {
            for (var t : api.takings(salonId, shift.openedAt(), until.plusMillis(1))) if ("CASH".equals(t.method()) && shift.currency().equals(t.currency())) cash = cash.add(t.total());
            for (var t : api.refunds(salonId, shift.openedAt(), until.plusMillis(1))) if ("CASH".equals(t.method()) && shift.currency().equals(t.currency())) cash = cash.subtract(t.total());
        }
        var expected = shift.openingFloat().add(cash).setScale(2, RoundingMode.HALF_UP);
        return new Shift(shift.id(), shift.currency(), shift.openingFloat(), shift.openedBy(), shift.openedAt(), shift.closedBy(), shift.closedAt(),
                shift.countedCash(), expected, shift.countedCash() == null ? null : shift.countedCash().subtract(expected), shift.note());
    }

    private static final String SELECT = "SELECT id, currency, opening_float, opened_by, opened_at, closed_by, closed_at, counted_cash, expected_cash, note FROM till_shift";

    private Optional<Shift> find(String where, UUID salonId) {
        return jdbc.sql(SELECT + " WHERE salon_id = :salon AND " + where).param("salon", salonId).query(TillShifts::shift).optional();
    }

    private static Shift shift(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        var counted = rs.getBigDecimal("counted_cash");
        var expected = rs.getBigDecimal("expected_cash");
        var closedAt = rs.getTimestamp("closed_at");
        return new Shift(rs.getLong("id"), rs.getString("currency"), rs.getBigDecimal("opening_float"), rs.getString("opened_by"),
                rs.getTimestamp("opened_at").toInstant(), rs.getString("closed_by"), closedAt == null ? null : closedAt.toInstant(),
                counted, expected, counted == null || expected == null ? null : counted.subtract(expected), rs.getString("note"));
    }
}
