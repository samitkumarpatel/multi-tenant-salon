package net.samitkumar.multi_tenant_salon.website.internal;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
class WebsiteDomainRepository {
    record Domain(UUID id, UUID salonId, String hostname, String token, String providerId, String status,
                  String message, Instant verifiedAt, Instant checkedAt, Instant createdAt, Instant activeUntil,
                  String dnsZone) {}
    private final JdbcTemplate jdbc;
    WebsiteDomainRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    private static final RowMapper<Domain> ROW = (r, n) -> new Domain(r.getObject("id", UUID.class),
            r.getObject("salon_id", UUID.class), r.getString("hostname"), r.getString("verification_token"),
            r.getString("provider_id"), r.getString("status"), r.getString("message"),
            r.getTimestamp("verified_at") == null ? null : r.getTimestamp("verified_at").toInstant(),
            r.getTimestamp("checked_at") == null ? null : r.getTimestamp("checked_at").toInstant(),
            r.getTimestamp("created_at").toInstant(),
            r.getTimestamp("active_until") == null ? null : r.getTimestamp("active_until").toInstant(),
            r.getString("dns_zone"));

    Optional<Domain> forSalon(UUID salonId) {
        return jdbc.query("SELECT * FROM website_domain WHERE salon_id = ?", ROW, salonId).stream().findFirst();
    }
    Optional<Domain> lock(UUID id) {
        return jdbc.query("SELECT * FROM website_domain WHERE id = ? FOR UPDATE SKIP LOCKED", ROW, id).stream().findFirst();
    }
    void create(UUID salonId, String hostname, String dnsZone) {
        jdbc.update("INSERT INTO website_domain(id, salon_id, hostname, verification_token, dns_zone) VALUES (?, ?, ?, ?, ?)",
                UUID.randomUUID(), salonId, hostname, UUID.randomUUID().toString().replace("-", ""), dnsZone);
    }
    List<UUID> due() {
        return jdbc.queryForList("""
                SELECT id FROM website_domain WHERE checked_at IS NULL OR checked_at < now() - interval '5 minutes'
                ORDER BY checked_at NULLS FIRST LIMIT 50
                """, UUID.class);
    }
    void provider(UUID id, String providerId) {
        jdbc.update("UPDATE website_domain SET provider_id = ?, verified_at = COALESCE(verified_at, now()) WHERE id = ?", providerId, id);
    }
    void verified(UUID id) {
        jdbc.update("UPDATE website_domain SET verified_at = COALESCE(verified_at, now()) WHERE id = ?", id);
    }
    void status(UUID id, String status, String message) {
        jdbc.update("UPDATE website_domain SET status = ?, message = ?, checked_at = now(), updated_at = now() WHERE id = ?", status, message, id);
    }
    void active(UUID id) {
        jdbc.update("UPDATE website_domain SET active_until = now() + interval '24 hours' WHERE id = ?", id);
        status(id, "ACTIVE", null);
    }
    void deleting(UUID salonId) {
        jdbc.update("UPDATE website_domain SET status = 'DELETING', message = NULL, checked_at = NULL, updated_at = now() WHERE salon_id = ?", salonId);
    }
    void delete(UUID id) { jdbc.update("DELETE FROM website_domain WHERE id = ?", id); }

    Optional<UUID> activeSalon(String hostname) {
        return jdbc.queryForList("""
                SELECT d.salon_id FROM website_domain d JOIN salon s ON s.id = d.salon_id
                WHERE d.hostname = ? AND d.status = 'ACTIVE' AND d.active_until > now() AND s.status = 'ACTIVE'
                AND EXISTS (SELECT 1 FROM salon_feature f WHERE f.salon_id = s.id AND f.feature = 'STATIC_WEBSITE')
                """, UUID.class, hostname).stream().findFirst();
    }
}
