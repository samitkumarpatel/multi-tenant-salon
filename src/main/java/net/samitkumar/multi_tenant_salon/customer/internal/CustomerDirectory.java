package net.samitkumar.multi_tenant_salon.customer.internal;

import net.samitkumar.multi_tenant_salon.booking.BookingApi;
import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import net.samitkumar.multi_tenant_salon.customer.internal.CustomerDirectoryViews.CustomerDetail;
import net.samitkumar.multi_tenant_salon.customer.internal.CustomerDirectoryViews.CustomerPage;
import net.samitkumar.multi_tenant_salon.customer.internal.CustomerDirectoryViews.CustomerSpec;
import net.samitkumar.multi_tenant_salon.membership.MembershipApi;
import net.samitkumar.multi_tenant_salon.membership.MembershipSubscription;
import net.samitkumar.multi_tenant_salon.shop.ShopOrderHistoryApi;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * The owner's customer list for one salon: search, add, edit and erase. History (bookings, orders,
 * memberships) is never copied here — it is read through each module's public API, and erasing a
 * customer rewrites it through the same APIs, so the modules' tables stay their own.
 */
@Service
class CustomerDirectory {

    private static final Logger log = LoggerFactory.getLogger(CustomerDirectory.class);

    /** History rows of an erased customer carry an address on this reserved TLD; the migration's backfill skips it. */
    static final String ANONYMIZED_DOMAIN = "anonymized.invalid";
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final int MAX_PAGE_SIZE = 200;

    private static final RowMapper<SalonCustomer> ROW = (ResultSet rs, int i) -> mapRow(rs);

    private final JdbcClient jdbc;
    private final BookingApi bookingApi;
    private final ShopOrderHistoryApi orderApi;
    private final MembershipApi membershipApi;
    private final CustomerAccountService accounts;

    CustomerDirectory(JdbcTemplate jdbcTemplate, BookingApi bookingApi, ShopOrderHistoryApi orderApi,
                      MembershipApi membershipApi, CustomerAccountService accounts) {
        this.jdbc = JdbcClient.create(jdbcTemplate);
        this.bookingApi = bookingApi;
        this.orderApi = orderApi;
        this.membershipApi = membershipApi;
        this.accounts = accounts;
    }

    private static SalonCustomer mapRow(ResultSet rs) throws SQLException {
        return new SalonCustomer(rs.getLong("id"), rs.getObject("salon_id", UUID.class), rs.getString("name"),
                rs.getString("email"), rs.getString("phone"), rs.getString("notes"),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant(),
                rs.getTimestamp("last_seen_at").toInstant());
    }

    // ── read ─────────────────────────────────────────────────────────────────

    CustomerPage list(UUID salonId, String q, String sort, int page, int size) {
        var pageSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        var pageIdx = Math.max(page, 0);
        var term = StringUtils.hasText(q) ? "%" + escapeLike(q.trim()) + "%" : null;
        var where = "salon_id = :salonId AND (CAST(:term AS TEXT) IS NULL OR name ILIKE :term OR email ILIKE :term OR phone ILIKE :term)";

        long total = jdbc.sql("SELECT count(*) FROM salon_customer WHERE " + where)
                .param("salonId", salonId).param("term", term).query(Long.class).single();
        var order = "name".equals(sort) ? "lower(name), id" : "last_seen_at DESC, id DESC";
        var content = jdbc.sql("SELECT * FROM salon_customer WHERE " + where + " ORDER BY " + order + " LIMIT :limit OFFSET :offset")
                .param("salonId", salonId).param("term", term)
                .param("limit", pageSize).param("offset", (long) pageIdx * pageSize)
                .query(ROW).list();
        return new CustomerPage(content, pageIdx, pageSize, total, (int) Math.ceil(total / (double) pageSize));
    }

    Optional<SalonCustomer> find(UUID salonId, Long id) {
        return jdbc.sql("SELECT * FROM salon_customer WHERE salon_id = :salonId AND id = :id")
                .param("salonId", salonId).param("id", id).query(ROW).optional();
    }

    Optional<CustomerDetail> detail(UUID salonId, Long id) {
        return find(salonId, id).map(c -> {
            var blocker = deleteBlocker(salonId, c.email());
            return new CustomerDetail(c, accounts.account(salonId, c.email()), blocker == null, blocker);
        });
    }

    // ── write ────────────────────────────────────────────────────────────────

    @Transactional
    SalonCustomer create(UUID salonId, CustomerSpec spec) {
        var name = requireName(spec);
        var email = spec.email() == null ? "" : spec.email().trim();
        if (!EMAIL.matcher(email).matches()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid email is required");
        if (email.toLowerCase().endsWith("@" + ANONYMIZED_DOMAIN)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A valid email is required");
        try {
            return jdbc.sql("""
                            INSERT INTO salon_customer (salon_id, name, email, phone, notes)
                            VALUES (:salonId, :name, :email, :phone, :notes) RETURNING *""")
                    .param("salonId", salonId).param("name", name).param("email", email)
                    .param("phone", blankToNull(spec.phone())).param("notes", blankToNull(spec.notes()))
                    .query(ROW).single();
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A customer with this email already exists");
        }
    }

    /** Name, phone and notes. Past bookings, orders and memberships keep the details they were made with. */
    Optional<SalonCustomer> update(UUID salonId, Long id, CustomerSpec spec) {
        var name = requireName(spec);
        return jdbc.sql("""
                        UPDATE salon_customer SET name = :name, phone = :phone, notes = :notes, updated_at = now()
                        WHERE salon_id = :salonId AND id = :id RETURNING *""")
                .param("salonId", salonId).param("id", id).param("name", name)
                .param("phone", blankToNull(spec.phone())).param("notes", blankToNull(spec.notes()))
                .query(ROW).optional();
    }

    /**
     * Erases the customer: their details are removed from every booking, order and membership (the
     * records themselves stay), their sign-in state is dropped, and the row goes. All or nothing.
     *
     * @return false when there is no such customer
     */
    @Transactional
    boolean delete(UUID salonId, Long id) {
        var customer = find(salonId, id).orElse(null);
        if (customer == null) return false;
        var blocker = deleteBlocker(salonId, customer.email());
        if (blocker != null) throw new ResponseStatusException(HttpStatus.CONFLICT, blocker);

        var replacement = "deleted-" + UUID.randomUUID() + "@" + ANONYMIZED_DOMAIN;
        int bookings = bookingApi.anonymizeCustomer(salonId, customer.email(), replacement);
        int orders = orderApi.anonymizeCustomer(salonId, customer.email(), replacement);
        int memberships = membershipApi.anonymizeCustomer(salonId, customer.email(), replacement);
        jdbc.sql("DELETE FROM customer_session WHERE salon_id = :salonId AND lower(email) = lower(:email)")
                .param("salonId", salonId).param("email", customer.email()).update();
        jdbc.sql("DELETE FROM customer_sign_in_code WHERE salon_id = :salonId AND lower(email) = lower(:email)")
                .param("salonId", salonId).param("email", customer.email()).update();
        jdbc.sql("DELETE FROM salon_customer WHERE salon_id = :salonId AND id = :id")
                .param("salonId", salonId).param("id", id).update();
        log.info("[CustomerDirectory] Erased customer {} of salon {}: {} bookings, {} orders, {} memberships anonymized",
                id, salonId, bookings, orders, memberships);
        return true;
    }

    /** Why this customer can't be erased right now, or null. */
    private String deleteBlocker(UUID salonId, String email) {
        var today = LocalDate.now();
        boolean upcoming = bookingApi.findByCustomerEmail(salonId, email).stream()
                .anyMatch(b -> (b.status() == BookingStatus.PENDING || b.status() == BookingStatus.CONFIRMED)
                        && b.appointmentDate() != null && !b.appointmentDate().isBefore(today));
        if (upcoming) return "This customer has an upcoming appointment. Cancel or complete it first.";
        boolean member = membershipApi.findByCustomerEmail(salonId, email).stream()
                .anyMatch(m -> m.status() == MembershipSubscription.Status.ACTIVE
                        || m.status() == MembershipSubscription.Status.PENDING_PAYMENT);
        if (member) return "This customer has an active membership. Cancel it first.";
        return null;
    }

    // ── event-driven upkeep ──────────────────────────────────────────────────

    /**
     * Records that the salon dealt with this person: adds them if new, otherwise only bumps
     * {@code last_seen_at} and fills a phone the record lacks. Never overwrites what the owner edited.
     * Idempotent, so a redelivered event is harmless.
     */
    @Transactional
    void seen(UUID salonId, String name, String email, String phone) {
        if (salonId == null || !StringUtils.hasText(email)) return;
        var clean = email.trim();
        if (clean.toLowerCase().endsWith("@" + ANONYMIZED_DOMAIN)) return;
        jdbc.sql("""
                        INSERT INTO salon_customer (salon_id, name, email, phone)
                        VALUES (:salonId, :name, :email, :phone)
                        ON CONFLICT (salon_id, (lower(email))) DO UPDATE
                           SET last_seen_at = now(), phone = COALESCE(salon_customer.phone, EXCLUDED.phone)""")
                .param("salonId", salonId).param("name", StringUtils.hasText(name) ? name.trim() : clean)
                .param("email", clean).param("phone", blankToNull(phone)).update();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static String requireName(CustomerSpec spec) {
        if (spec == null || !StringUtils.hasText(spec.name())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A name is required");
        return spec.name().trim();
    }

    private static String blankToNull(String s) {
        return StringUtils.hasText(s) ? s.trim() : null;
    }

    private static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
