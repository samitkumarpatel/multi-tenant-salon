package net.samitkumar.multi_tenant_salon.booking.internal;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Serializes everything that rewrites one stylist's weekly availability: the owner saving a schedule,
 * the onboarding seed and the opening-hours sync. The last two arrive asynchronously as module events,
 * so without this an owner editing a brand-new stylist's hours could interleave with the seed and leave
 * two rows for the same day. A Postgres transaction-scoped advisory lock keyed on
 * {@code (LOCK_CLASS, staffId)}: released at commit or rollback, so it must be taken inside a transaction.
 */
@Component
class StaffScheduleLock {
    /** Negative, so it never meets {@code lockStaffDay}'s (staffId, epochDay) keys or membership's plan lock. */
    private static final int LOCK_CLASS = -7302;

    private final JdbcClient jdbc;

    StaffScheduleLock(JdbcTemplate jdbcTemplate) {
        this.jdbc = JdbcClient.create(jdbcTemplate);
    }

    void lock(Long staffId) {
        jdbc.sql("SELECT pg_advisory_xact_lock(:cls, :staff)")
                .param("cls", LOCK_CLASS).param("staff", staffId.intValue())
                .query().singleColumn();
    }
}
