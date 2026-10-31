package net.samitkumar.multi_tenant_salon.announcement.internal;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Service
class AnnouncementService {
    record Announcement(long id, String title, String message, String severity, String audience, String linkUrl,
                        String linkLabel, OffsetDateTime startsAt, OffsetDateTime endsAt, boolean active,
                        String createdBy, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
    /** What visitors see: no author, no schedule bookkeeping. */
    record PublicAnnouncement(long id, String title, String message, String severity, String linkUrl, String linkLabel) {}

    private static final String COLUMNS = "id,title,message,severity,audience,link_url,link_label,starts_at,ends_at,active,created_by,created_at,updated_at";

    private final JdbcClient jdbc;
    AnnouncementService(JdbcClient jdbc) { this.jdbc = jdbc; }

    /** Live now: switched on and inside its window. Owners also see the everywhere ones; other apps only those. */
    List<PublicAnnouncement> current(boolean forOwners) {
        return jdbc.sql("""
                SELECT id,title,message,severity,link_url,link_label FROM announcement
                WHERE active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
                  AND (audience = 'ALL_APPS' OR (:owners AND audience = 'SALON_OWNERS'))
                ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END, starts_at DESC, id DESC""")
                .param("owners", forOwners)
                .query((rs, i) -> new PublicAnnouncement(rs.getLong("id"), rs.getString("title"), rs.getString("message"),
                        rs.getString("severity"), rs.getString("link_url"), rs.getString("link_label"))).list();
    }

    List<Announcement> all() {
        return jdbc.sql("SELECT " + COLUMNS + " FROM announcement ORDER BY created_at DESC,id DESC")
                .query(AnnouncementService::map).list();
    }

    Optional<Announcement> find(long id) {
        return jdbc.sql("SELECT " + COLUMNS + " FROM announcement WHERE id=:id").param("id", id).query(AnnouncementService::map).optional();
    }

    Announcement create(AnnouncementController.Request r, String author) {
        long id = jdbc.sql("""
                INSERT INTO announcement(title,message,severity,audience,link_url,link_label,starts_at,ends_at,active,created_by)
                VALUES (:title,:message,:severity,:audience,:linkUrl,:linkLabel,coalesce(:startsAt,now()),:endsAt,:active,:author)
                RETURNING id""")
                .param("title", r.title().trim()).param("message", r.message().trim()).param("severity", r.severity())
                .param("audience", r.audience()).param("linkUrl", blankToNull(r.linkUrl())).param("linkLabel", blankToNull(r.linkLabel()))
                .param("startsAt", r.startsAt()).param("endsAt", r.endsAt()).param("active", r.active() == null || r.active())
                .param("author", author).query(Long.class).single();
        return find(id).orElseThrow();
    }

    Optional<Announcement> update(long id, AnnouncementController.Request r) {
        int n = jdbc.sql("""
                UPDATE announcement SET title=:title,message=:message,severity=:severity,audience=:audience,link_url=:linkUrl,
                       link_label=:linkLabel,starts_at=coalesce(:startsAt,starts_at),ends_at=:endsAt,
                       active=coalesce(:active,active),updated_at=now() WHERE id=:id""")
                .param("id", id).param("title", r.title().trim()).param("message", r.message().trim()).param("severity", r.severity())
                .param("audience", r.audience()).param("linkUrl", blankToNull(r.linkUrl())).param("linkLabel", blankToNull(r.linkLabel()))
                .param("startsAt", r.startsAt()).param("endsAt", r.endsAt()).param("active", r.active()).update();
        return n == 0 ? Optional.empty() : find(id);
    }

    boolean delete(long id) { return jdbc.sql("DELETE FROM announcement WHERE id=:id").param("id", id).update() > 0; }

    private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.trim(); }

    private static Announcement map(java.sql.ResultSet rs, int i) throws java.sql.SQLException {
        return new Announcement(rs.getLong("id"), rs.getString("title"), rs.getString("message"), rs.getString("severity"),
                rs.getString("audience"), rs.getString("link_url"), rs.getString("link_label"),
                rs.getObject("starts_at", OffsetDateTime.class), rs.getObject("ends_at", OffsetDateTime.class),
                rs.getBoolean("active"), rs.getString("created_by"),
                rs.getObject("created_at", OffsetDateTime.class), rs.getObject("updated_at", OffsetDateTime.class));
    }
}
