package net.samitkumar.multi_tenant_salon.loyalty.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.loyalty.CounterReward;
import net.samitkumar.multi_tenant_salon.loyalty.CustomerLoyalty;
import net.samitkumar.multi_tenant_salon.loyalty.CustomerLoyalty.Entry;
import net.samitkumar.multi_tenant_salon.loyalty.CustomerLoyalty.Program;
import net.samitkumar.multi_tenant_salon.loyalty.CustomerLoyalty.Redemption;
import net.samitkumar.multi_tenant_salon.loyalty.CustomerLoyalty.Reward;
import net.samitkumar.multi_tenant_salon.loyalty.LoyaltyApi;
import net.samitkumar.multi_tenant_salon.loyalty.LoyaltyRedeemedEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * The loyalty programme. The ledger is insert-only and a balance is always {@code SUM(delta)}, so there
 * is no counter to drift. Everything that writes for one customer takes the same advisory lock, and every
 * event-driven write is keyed on its source, so at-least-once delivery cannot earn twice.
 */
@Service
@Slf4j
class LoyaltyService implements LoyaltyApi {
    static final String EARN_BOOKING = "EARN_BOOKING";
    static final String EARN_ORDER = "EARN_ORDER";
    static final String SOURCE_BOOKING = "BOOKING";
    static final String SOURCE_ORDER = "ORDER";
    static final String EARN_POS = "EARN_POS";
    static final String SOURCE_POS = "POS_SALE";
    static final Set<String> REWARD_TYPES = Set.of("DISCOUNT_AMOUNT", "FREE_SERVICE", "FREE_PRODUCT", "CUSTOM");
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int HISTORY_LIMIT = 100;
    private static final int MAX_ADJUSTMENT = 100_000;
    private static final SecureRandom RANDOM = new SecureRandom();

    record ProgramSpec(Boolean enabled, BigDecimal pointsPerUnit, Boolean earnOnBookings, Boolean earnOnOrders, Integer expiryMonths) {}

    record RewardSpec(String name, String description, Integer pointsCost, String type, BigDecimal value, Boolean active) {}

    record MemberSummary(String email, int balance, int earned, Instant lastActivity) {}

    record MemberDetail(String email, int balance, List<Entry> history, List<AdminRedemption> redemptions) {}

    record AdminRedemption(Long id, String email, String rewardName, int points, String code, String status,
                           Instant createdAt, Instant usedAt, String usedBy, String rewardType, BigDecimal rewardValue) {}

    record Overview(Program program, List<Reward> rewards, long members, long outstandingPoints, long pendingRedemptions) {}

    private final JdbcClient jdbc;
    private final SalonApi salons;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate tx;

    LoyaltyService(JdbcClient jdbc, SalonApi salons, ApplicationEventPublisher events, TransactionTemplate tx) {
        this.jdbc = jdbc;
        this.salons = salons;
        this.events = events;
        this.tx = tx;
    }

    // ── programme + rewards ─────────────────────────────────────────────────────

    Program program(UUID salonId) {
        return jdbc.sql("SELECT enabled, points_per_unit, earn_on_bookings, earn_on_orders, expiry_months FROM loyalty_program WHERE salon_id = :salon")
                .param("salon", salonId)
                .query((rs, row) -> new Program(rs.getBoolean("enabled"), rs.getBigDecimal("points_per_unit"),
                        rs.getBoolean("earn_on_bookings"), rs.getBoolean("earn_on_orders"), rs.getObject("expiry_months", Integer.class)))
                .optional().orElse(new Program(false, BigDecimal.ONE, true, true, null));
    }

    boolean featureOn(UUID salonId) {
        return salons.findById(salonId)
                .map(salon -> salon.features().stream().anyMatch(f -> f.feature() == SalonFeature.LOYALTY_PROGRAM))
                .orElse(false);
    }

    /** Whether points are being earned and redeemed for this salon right now. */
    boolean running(UUID salonId) {
        return featureOn(salonId) && program(salonId).enabled();
    }

    @Transactional
    Program saveProgram(UUID salonId, ProgramSpec spec) {
        var current = program(salonId);
        var perUnit = spec.pointsPerUnit() == null ? current.pointsPerUnit() : spec.pointsPerUnit();
        if (perUnit.signum() < 0 || perUnit.compareTo(BigDecimal.valueOf(1000)) > 0) throw bad("Points per unit must be between 0 and 1000");
        var expiry = spec.expiryMonths() == null ? null : spec.expiryMonths();
        if (expiry != null && (expiry < 1 || expiry > 120)) throw bad("Expiry must be between 1 and 120 months");
        jdbc.sql("""
                INSERT INTO loyalty_program (salon_id, enabled, points_per_unit, earn_on_bookings, earn_on_orders, expiry_months, updated_at)
                VALUES (:salon, :enabled, :perUnit, :bookings, :orders, :expiry, now())
                ON CONFLICT (salon_id) DO UPDATE SET enabled = EXCLUDED.enabled, points_per_unit = EXCLUDED.points_per_unit,
                    earn_on_bookings = EXCLUDED.earn_on_bookings, earn_on_orders = EXCLUDED.earn_on_orders,
                    expiry_months = EXCLUDED.expiry_months, updated_at = now()
                """)
                .param("salon", salonId)
                .param("enabled", spec.enabled() == null ? current.enabled() : spec.enabled())
                .param("perUnit", perUnit)
                .param("bookings", spec.earnOnBookings() == null ? current.earnOnBookings() : spec.earnOnBookings())
                .param("orders", spec.earnOnOrders() == null ? current.earnOnOrders() : spec.earnOnOrders())
                .param("expiry", expiry)
                .update();
        return program(salonId);
    }

    List<Reward> rewards(UUID salonId, boolean activeOnly) {
        return jdbc.sql("""
                SELECT id, name, description, points_cost, reward_type, reward_value, active FROM loyalty_reward
                WHERE salon_id = :salon""" + (activeOnly ? " AND active" : "") + " ORDER BY points_cost, id")
                .param("salon", salonId).query(LoyaltyService::reward).list();
    }

    @Transactional
    Reward createReward(UUID salonId, RewardSpec spec) {
        var checked = checkReward(spec);
        long id = jdbc.sql("""
                INSERT INTO loyalty_reward (salon_id, name, description, points_cost, reward_type, reward_value, active)
                VALUES (:salon, :name, :description, :cost, :type, :value, :active) RETURNING id
                """)
                .param("salon", salonId).param("name", checked.name()).param("description", checked.description())
                .param("cost", checked.pointsCost()).param("type", checked.type()).param("value", checked.value())
                .param("active", checked.active() == null || checked.active())
                .query(Long.class).single();
        return rewardOf(salonId, id).orElseThrow();
    }

    @Transactional
    Optional<Reward> updateReward(UUID salonId, Long id, RewardSpec spec) {
        var checked = checkReward(spec);
        int changed = jdbc.sql("""
                UPDATE loyalty_reward SET name = :name, description = :description, points_cost = :cost, reward_type = :type,
                    reward_value = :value, active = :active WHERE id = :id AND salon_id = :salon
                """)
                .param("name", checked.name()).param("description", checked.description()).param("cost", checked.pointsCost())
                .param("type", checked.type()).param("value", checked.value())
                .param("active", checked.active() == null || checked.active()).param("id", id).param("salon", salonId).update();
        return changed == 0 ? Optional.empty() : rewardOf(salonId, id);
    }

    @Transactional
    boolean deleteReward(UUID salonId, Long id) {
        return jdbc.sql("DELETE FROM loyalty_reward WHERE id = :id AND salon_id = :salon").param("id", id).param("salon", salonId).update() == 1;
    }

    private Optional<Reward> rewardOf(UUID salonId, Long id) {
        return jdbc.sql("SELECT id, name, description, points_cost, reward_type, reward_value, active FROM loyalty_reward WHERE id = :id AND salon_id = :salon")
                .param("id", id).param("salon", salonId).query(LoyaltyService::reward).optional();
    }

    private static RewardSpec checkReward(RewardSpec spec) {
        var name = spec.name() == null ? "" : spec.name().strip();
        if (name.isEmpty() || name.length() > 120) throw bad("A reward needs a name of up to 120 characters");
        if (spec.pointsCost() == null || spec.pointsCost() < 1 || spec.pointsCost() > 1_000_000) throw bad("Points cost must be between 1 and 1,000,000");
        var type = spec.type() == null ? "CUSTOM" : spec.type().toUpperCase(Locale.ROOT);
        if (!REWARD_TYPES.contains(type)) throw bad("Unknown reward type");
        if (spec.value() != null && spec.value().signum() < 0) throw bad("Reward value cannot be negative");
        var description = spec.description() == null || spec.description().isBlank() ? null : spec.description().strip();
        return new RewardSpec(name, description, spec.pointsCost(), type, spec.value(), spec.active());
    }

    Overview overview(UUID salonId) {
        long members = jdbc.sql("SELECT COUNT(DISTINCT email) FROM loyalty_ledger WHERE salon_id = :salon").param("salon", salonId).query(Long.class).single();
        long outstanding = jdbc.sql("SELECT COALESCE(SUM(delta), 0) FROM loyalty_ledger WHERE salon_id = :salon").param("salon", salonId).query(Long.class).single();
        long pending = jdbc.sql("SELECT COUNT(*) FROM loyalty_redemption WHERE salon_id = :salon AND status = 'ISSUED'").param("salon", salonId).query(Long.class).single();
        return new Overview(program(salonId), rewards(salonId, false), members, outstanding, pending);
    }

    // ── earning (event-driven, idempotent) ──────────────────────────────────────

    /** Awards points for {@code amount} spent, once per source. Silent when the programme is off or the amount rounds to nothing. */
    @Transactional
    void earn(UUID salonId, String email, String reason, String sourceType, String sourceId, BigDecimal amount) {
        if (email == null || email.isBlank() || amount == null || amount.signum() <= 0) return;
        if (!featureOn(salonId)) return;
        var program = program(salonId);
        if (!program.enabled() || !(EARN_BOOKING.equals(reason) ? program.earnOnBookings() : program.earnOnOrders())) return;
        int points = amount.multiply(program.pointsPerUnit()).setScale(0, RoundingMode.DOWN).intValue();
        if (points <= 0) return;
        var expires = program.expiryMonths() == null ? null : OffsetDateTime.now(ZoneOffset.UTC).plusMonths(program.expiryMonths());
        int inserted = jdbc.sql("""
                INSERT INTO loyalty_ledger (salon_id, email, delta, reason, source_type, source_id, expires_at)
                VALUES (:salon, :email, :delta, :reason, :sourceType, :sourceId, :expires)
                ON CONFLICT (salon_id, reason, source_type, source_id) DO NOTHING
                """)
                .param("salon", salonId).param("email", normalize(email)).param("delta", points).param("reason", reason)
                .param("sourceType", sourceType).param("sourceId", sourceId).param("expires", expires).update();
        if (inserted == 1) log.info("[LoyaltyService] +{} points for {} (salon={}, {} {})", points, normalize(email), salonId, sourceType, sourceId);
    }

    /** Takes back what a booking or order earned (it was cancelled, no-show or never paid). A no-op if nothing was earned or it is already reversed. */
    @Transactional
    void reverse(UUID salonId, String earnReason, String sourceType, String sourceId) {
        int inserted = jdbc.sql("""
                INSERT INTO loyalty_ledger (salon_id, email, delta, reason, source_type, source_id, note)
                SELECT salon_id, email, -delta, 'REVERSAL', source_type, source_id, 'Points taken back: ' || :sourceType || ' no longer counts'
                FROM loyalty_ledger WHERE salon_id = :salon AND reason = :earnReason AND source_type = :sourceType AND source_id = :sourceId
                ON CONFLICT (salon_id, reason, source_type, source_id) DO NOTHING
                """)
                .param("salon", salonId).param("earnReason", earnReason).param("sourceType", sourceType).param("sourceId", sourceId).update();
        if (inserted == 1) log.info("[LoyaltyService] Reversed {} {} (salon={})", sourceType, sourceId, salonId);
    }

    // ── customer view + redeeming ───────────────────────────────────────────────

    @Override
    public CustomerLoyalty forCustomer(UUID salonId, String customerEmail) {
        var program = program(salonId);
        if (!featureOn(salonId) || !program.enabled()) return new CustomerLoyalty(false, 0, program, List.of(), List.of(), List.of());
        var email = normalize(customerEmail);
        return new CustomerLoyalty(true, balance(salonId, email), program, rewards(salonId, true), history(salonId, email),
                redemptionsOf(salonId, email).stream().map(r -> new Redemption(r.id(), r.rewardName(), r.points(), r.code(), r.status(), r.createdAt(), r.usedAt())).toList());
    }

    @Override
    @Transactional
    public Redemption redeem(UUID salonId, String customerEmail, Long rewardId) {
        if (!running(salonId)) throw new ResponseStatusException(HttpStatus.CONFLICT, "The loyalty programme is not available");
        var email = normalize(customerEmail);
        var reward = rewardOf(salonId, rewardId).filter(Reward::active)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reward not found"));
        lock(salonId, email);
        int balance = balance(salonId, email);
        if (balance < reward.pointsCost()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Not enough points for this reward");
        long id = 0;
        String code = null;
        for (int attempt = 0; attempt < 5 && code == null; attempt++) {
            var candidate = newCode();
            var inserted = jdbc.sql("""
                    INSERT INTO loyalty_redemption (salon_id, reward_id, reward_name, email, points, code)
                    VALUES (:salon, :reward, :name, :email, :points, :code)
                    ON CONFLICT (salon_id, code) DO NOTHING RETURNING id
                    """)
                    .param("salon", salonId).param("reward", reward.id()).param("name", reward.name()).param("email", email)
                    .param("points", reward.pointsCost()).param("code", candidate).query(Long.class).optional();
            if (inserted.isPresent()) { id = inserted.get(); code = candidate; }
        }
        if (code == null) throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not issue a code, please try again");
        jdbc.sql("""
                INSERT INTO loyalty_ledger (salon_id, email, delta, reason, source_type, source_id, note)
                VALUES (:salon, :email, :delta, 'REDEEM', 'REDEMPTION', :id, :note)
                """)
                .param("salon", salonId).param("email", email).param("delta", -reward.pointsCost()).param("id", String.valueOf(id))
                .param("note", reward.name()).update();
        var salon = salons.findById(salonId).orElse(null);
        events.publishEvent(new LoyaltyRedeemedEvent(id, salonId, email, reward.name(), code, reward.pointsCost(),
                balance - reward.pointsCost(), salon == null ? null : salon.name(),
                salon == null || salon.contact() == null ? null : salon.contact().phone(),
                salon == null || salon.contact() == null ? null : salon.contact().email()));
        return new Redemption(id, reward.name(), reward.pointsCost(), code, "ISSUED", Instant.now(), null);
    }

    @Override
    @Transactional
    public int anonymizeCustomer(UUID salonId, String email, String replacementEmail) {
        var from = normalize(email);
        int ledger = jdbc.sql("UPDATE loyalty_ledger SET email = :to, actor = NULL WHERE salon_id = :salon AND email = :from")
                .param("to", replacementEmail).param("salon", salonId).param("from", from).update();
        int redemptions = jdbc.sql("UPDATE loyalty_redemption SET email = :to, used_by = NULL WHERE salon_id = :salon AND email = :from")
                .param("to", replacementEmail).param("salon", salonId).param("from", from).update();
        return ledger + redemptions;
    }

    // ── owner / desk ────────────────────────────────────────────────────────────

    List<MemberSummary> members(UUID salonId, String query) {
        var q = query == null ? "" : query.strip().toLowerCase(Locale.ROOT);
        return jdbc.sql("""
                SELECT email, COALESCE(SUM(delta), 0) AS balance,
                       COALESCE(SUM(delta) FILTER (WHERE delta > 0 AND reason LIKE 'EARN%'), 0) AS earned,
                       MAX(created_at) AS last_activity
                FROM loyalty_ledger WHERE salon_id = :salon AND (:q = '' OR position(:q in email) > 0)
                GROUP BY email ORDER BY balance DESC, email LIMIT 200
                """)
                .param("salon", salonId).param("q", q)
                .query((rs, row) -> new MemberSummary(rs.getString("email"), rs.getInt("balance"), rs.getInt("earned"), instant(rs.getTimestamp("last_activity"))))
                .list();
    }

    MemberDetail member(UUID salonId, String email) {
        var key = normalize(email);
        return new MemberDetail(key, balance(salonId, key), history(salonId, key), redemptionsOf(salonId, key));
    }

    @Transactional
    MemberDetail adjust(UUID salonId, String email, int points, String note, String actor) {
        var key = normalize(email);
        if (key.isEmpty() || !key.contains("@")) throw bad("A customer email is required");
        if (points == 0 || Math.abs(points) > MAX_ADJUSTMENT) throw bad("Adjustment must be a non-zero number of points up to " + MAX_ADJUSTMENT);
        if (note == null || note.isBlank()) throw bad("A reason is required for a manual adjustment");
        lock(salonId, key);
        if (balance(salonId, key) + points < 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "That would take the balance below zero");
        jdbc.sql("INSERT INTO loyalty_ledger (salon_id, email, delta, reason, note, actor) VALUES (:salon, :email, :delta, 'ADJUST', :note, :actor)")
                .param("salon", salonId).param("email", key).param("delta", points).param("note", note.strip()).param("actor", actor).update();
        return member(salonId, key);
    }

    List<AdminRedemption> listRedemptions(UUID salonId, String status) {
        return jdbc.sql(REDEMPTION_SELECT + " WHERE salon_id = :salon AND (:status = '' OR status = :status) ORDER BY created_at DESC, id DESC LIMIT 200")
                .param("salon", salonId).param("status", status == null ? "" : status.toUpperCase(Locale.ROOT))
                .query(LoyaltyService::redemption).list();
    }

    Optional<AdminRedemption> redemptionByCode(UUID salonId, String code) {
        return jdbc.sql(REDEMPTION_SELECT + " WHERE salon_id = :salon AND code = :code")
                .param("salon", salonId).param("code", code == null ? "" : code.strip().toUpperCase(Locale.ROOT))
                .query(LoyaltyService::redemption).optional();
    }

    /** The reward is handed over. Conditional on {@code ISSUED}, so the same code cannot be used twice. */
    @Transactional
    AdminRedemption markUsed(UUID salonId, Long id, String actor) {
        int changed = jdbc.sql("UPDATE loyalty_redemption SET status = 'USED', used_at = now(), used_by = :actor WHERE id = :id AND salon_id = :salon AND status = 'ISSUED'")
                .param("actor", actor).param("id", id).param("salon", salonId).update();
        return settled(salonId, id, changed);
    }

    @Override
    @Transactional
    public CounterReward useAtCounter(UUID salonId, String code, String actor) {
        var redemption = redemptionByCode(salonId, code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No reward with that code"));
        if (!"DISCOUNT_AMOUNT".equals(redemption.rewardType()) || redemption.rewardValue() == null || redemption.rewardValue().signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This reward is handed over by hand, not taken off the sale");
        }
        markUsed(salonId, redemption.id(), actor); // 409 when it is already used or cancelled
        return new CounterReward(redemption.id(), redemption.rewardName(), redemption.rewardValue(), redemption.email());
    }

    @Override
    @Transactional
    public void reopenCounterReward(UUID salonId, Long redemptionId) {
        jdbc.sql("UPDATE loyalty_redemption SET status = 'ISSUED', used_at = NULL, used_by = NULL WHERE id = :id AND salon_id = :salon AND status = 'USED'")
                .param("id", redemptionId).param("salon", salonId).update();
    }

    /** The owner voids an issued code and the points go back to the customer, once. */
    @Transactional
    AdminRedemption cancel(UUID salonId, Long id, String actor) {
        int changed = jdbc.sql("UPDATE loyalty_redemption SET status = 'CANCELLED', used_at = now(), used_by = :actor WHERE id = :id AND salon_id = :salon AND status = 'ISSUED'")
                .param("actor", actor).param("id", id).param("salon", salonId).update();
        if (changed == 1) {
            jdbc.sql("""
                    INSERT INTO loyalty_ledger (salon_id, email, delta, reason, source_type, source_id, note, actor)
                    SELECT salon_id, email, points, 'REDEEM_REFUND', 'REDEMPTION', id::text, 'Redemption cancelled: ' || reward_name, :actor
                    FROM loyalty_redemption WHERE id = :id AND salon_id = :salon
                    ON CONFLICT (salon_id, reason, source_type, source_id) DO NOTHING
                    """).param("actor", actor).param("id", id).param("salon", salonId).update();
        }
        return settled(salonId, id, changed);
    }

    private AdminRedemption settled(UUID salonId, Long id, int changed) {
        var redemption = jdbc.sql(REDEMPTION_SELECT + " WHERE id = :id AND salon_id = :salon").param("id", id).param("salon", salonId)
                .query(LoyaltyService::redemption).optional().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Redemption not found"));
        if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "This code is already " + redemption.status().toLowerCase(Locale.ROOT));
        return redemption;
    }

    // ── expiry ──────────────────────────────────────────────────────────────────

    /**
     * Writes an {@code EXPIRE} row for every earn whose time has passed and whose points are still
     * unspent. Spending draws on the oldest points first, so a customer who redeemed recently loses
     * nothing that they already used. One row per earn, so running twice changes nothing.
     */
    @Override
    @Scheduled(cron = "${spring.application.loyalty.expiry-cron:0 15 3 * * *}")
    public int expireDue() {
        var customers = jdbc.sql("""
                SELECT DISTINCT e.salon_id, e.email FROM loyalty_ledger e
                WHERE e.delta > 0 AND e.expires_at <= now() AND NOT EXISTS (
                    SELECT 1 FROM loyalty_ledger x WHERE x.salon_id = e.salon_id AND x.reason = 'EXPIRE'
                      AND x.source_type = 'LEDGER' AND x.source_id = e.id::text)
                """).query((rs, row) -> new Object[]{rs.getObject("salon_id", UUID.class), rs.getString("email")}).list();
        int expired = 0;
        for (var customer : customers) {
            try {
                Integer rows = tx.execute(status -> expireFor((UUID) customer[0], (String) customer[1]));
                expired += rows == null ? 0 : rows;
            } catch (RuntimeException e) {
                log.warn("[LoyaltyService] Expiry failed for {} (salon={}): {}", customer[1], customer[0], e.toString());
            }
        }
        if (expired > 0) log.info("[LoyaltyService] Expired {} earn rows", expired);
        return expired;
    }

    int expireFor(UUID salonId, String email) {
        lock(salonId, email);
        record Row(long id, int delta, String reason, boolean due, Long sourceLedgerId) {}
        var rows = jdbc.sql("""
                SELECT id, delta, reason, (expires_at IS NOT NULL AND expires_at <= now()) AS due,
                       CASE WHEN reason = 'EXPIRE' AND source_type = 'LEDGER' THEN source_id::bigint END AS source_ledger
                FROM loyalty_ledger WHERE salon_id = :salon AND email = :email ORDER BY created_at, id
                """).param("salon", salonId).param("email", email)
                .query((rs, row) -> new Row(rs.getLong("id"), rs.getInt("delta"), rs.getString("reason"), rs.getBoolean("due"),
                        rs.getObject("source_ledger", Long.class))).list();
        long spent = rows.stream().filter(r -> r.delta() < 0 && !"EXPIRE".equals(r.reason())).mapToLong(r -> -r.delta()).sum();
        var alreadyExpired = new java.util.HashMap<Long, Integer>();
        rows.stream().filter(r -> r.sourceLedgerId() != null).forEach(r -> alreadyExpired.merge(r.sourceLedgerId(), -r.delta(), Integer::sum));
        int written = 0;
        for (var earn : rows) {
            if (earn.delta() <= 0) continue;
            long capacity = earn.delta() - alreadyExpired.getOrDefault(earn.id(), 0);
            long used = Math.min(capacity, spent);
            spent -= used;
            long remaining = capacity - used;
            if (earn.due() && remaining > 0 && !alreadyExpired.containsKey(earn.id())) {
                written += jdbc.sql("""
                        INSERT INTO loyalty_ledger (salon_id, email, delta, reason, source_type, source_id, note)
                        VALUES (:salon, :email, :delta, 'EXPIRE', 'LEDGER', :source, 'Points expired')
                        ON CONFLICT (salon_id, reason, source_type, source_id) DO NOTHING
                        """).param("salon", salonId).param("email", email).param("delta", (int) -remaining)
                        .param("source", String.valueOf(earn.id())).update();
            }
        }
        return written;
    }

    // ── helpers ─────────────────────────────────────────────────────────────────

    int balance(UUID salonId, String email) {
        return jdbc.sql("SELECT COALESCE(SUM(delta), 0) FROM loyalty_ledger WHERE salon_id = :salon AND email = :email")
                .param("salon", salonId).param("email", email).query(Integer.class).single();
    }

    private List<Entry> history(UUID salonId, String email) {
        return jdbc.sql("""
                SELECT id, delta, reason, note, created_at, expires_at FROM loyalty_ledger
                WHERE salon_id = :salon AND email = :email ORDER BY created_at DESC, id DESC LIMIT """ + " " + HISTORY_LIMIT)
                .param("salon", salonId).param("email", email)
                .query((rs, row) -> new Entry(rs.getLong("id"), rs.getInt("delta"), rs.getString("reason"), rs.getString("note"),
                        instant(rs.getTimestamp("created_at")), instant(rs.getTimestamp("expires_at")))).list();
    }

    private List<AdminRedemption> redemptionsOf(UUID salonId, String email) {
        return jdbc.sql(REDEMPTION_SELECT + " WHERE salon_id = :salon AND email = :email ORDER BY created_at DESC, id DESC LIMIT " + HISTORY_LIMIT)
                .param("salon", salonId).param("email", email).query(LoyaltyService::redemption).list();
    }

    /** Serializes everything that moves one customer's points; released at commit. */
    private void lock(UUID salonId, String email) {
        jdbc.sql("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))").param("key", salonId + "|" + email).query((rs, row) -> 1).list();
    }

    static String normalize(String email) {
        return email == null ? "" : email.strip().toLowerCase(Locale.ROOT);
    }

    private static String newCode() {
        var code = new StringBuilder(8);
        for (int i = 0; i < 8; i++) code.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
        return code.toString();
    }

    private static final String REDEMPTION_SELECT =
            "SELECT id, email, reward_name, points, code, status, created_at, used_at, used_by,\n"
                    + "(SELECT r.reward_type FROM loyalty_reward r WHERE r.id = loyalty_redemption.reward_id) AS reward_type,\n"
                    + "(SELECT r.reward_value FROM loyalty_reward r WHERE r.id = loyalty_redemption.reward_id) AS reward_value FROM loyalty_redemption";

    private static AdminRedemption redemption(ResultSet rs, int row) throws SQLException {
        return new AdminRedemption(rs.getLong("id"), rs.getString("email"), rs.getString("reward_name"), rs.getInt("points"),
                rs.getString("code"), rs.getString("status"), instant(rs.getTimestamp("created_at")),
                instant(rs.getTimestamp("used_at")), rs.getString("used_by"), rs.getString("reward_type"), rs.getBigDecimal("reward_value"));
    }

    private static Reward reward(ResultSet rs, int row) throws SQLException {
        return new Reward(rs.getLong("id"), rs.getString("name"), rs.getString("description"), rs.getInt("points_cost"),
                rs.getString("reward_type"), rs.getBigDecimal("reward_value"), rs.getBoolean("active"));
    }

    private static Instant instant(Timestamp ts) {
        return ts == null ? null : ts.toInstant();
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
