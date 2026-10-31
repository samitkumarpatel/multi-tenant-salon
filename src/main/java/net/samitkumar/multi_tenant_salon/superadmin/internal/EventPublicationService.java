package net.samitkumar.multi_tenant_salon.superadmin.internal;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
class EventPublicationService {
    record Entry(UUID id, String eventType, String listenerId, String status, String publicationDate,
                 String completionDate, Integer completionAttempts, String lastResubmissionDate, boolean archived) {}
    record Detail(Entry entry, String serializedEvent) {}
    record Page(List<Entry> content, int page, int size, long totalElements, int totalPages) {}
    record StatusCount(String status, long count) {}

    private static final Set<String> STATUSES = Set.of("PUBLISHED", "PROCESSING", "RESUBMITTED", "FAILED", "COMPLETED");

    /** Live and archived publications behave as one list; the archive only ever holds completed ones. */
    private static final String ALL = """
            SELECT id,event_type,listener_id,status,publication_date,completion_date,completion_attempts,last_resubmission_date,
                   serialized_event,false archived FROM event_publication
            UNION ALL
            SELECT id,event_type,listener_id,status,publication_date,completion_date,completion_attempts,last_resubmission_date,
                   serialized_event,true archived FROM event_publication_archive""";

    private final JdbcClient jdbc;
    EventPublicationService(JdbcClient jdbc) { this.jdbc = jdbc; }

    Page list(String q, String status, int requestedPage, int requestedSize) {
        int size = Math.clamp(requestedSize, 1, 100), page = Math.clamp(requestedPage, 0, 100000);
        String state = status == null ? "ALL" : status.trim().toUpperCase(java.util.Locale.ROOT);
        String filter = STATUSES.contains(state) ? state : "";
        String term = q == null ? "" : q.trim();
        String where = """
                WHERE (:status = '' OR coalesce(e.status, CASE WHEN e.completion_date IS NULL THEN 'PUBLISHED' ELSE 'COMPLETED' END) = :status)
                  AND (:q = '' OR e.event_type ILIKE '%' || :q || '%' OR e.listener_id ILIKE '%' || :q || '%')""";
        long total = jdbc.sql("SELECT count(*) FROM (" + ALL + ") e " + where)
                .param("status", filter).param("q", term).query(Long.class).single();
        var rows = jdbc.sql("""
                SELECT e.id,e.event_type,e.listener_id,
                       coalesce(e.status, CASE WHEN e.completion_date IS NULL THEN 'PUBLISHED' ELSE 'COMPLETED' END) status,
                       e.publication_date::text publication_date,e.completion_date::text completion_date,
                       e.completion_attempts,e.last_resubmission_date::text last_resubmission_date,e.archived
                FROM (""" + ALL + ") e " + where + """
                 ORDER BY e.publication_date DESC,e.id LIMIT :size OFFSET :offset""")
                .param("status", filter).param("q", term).param("size", size).param("offset", (long) page * size)
                .query((rs, i) -> entry(rs)).list();
        return new Page(rows, page, size, total, (int) ((total + size - 1) / size));
    }

    List<StatusCount> summary() {
        return jdbc.sql("""
                SELECT coalesce(e.status, CASE WHEN e.completion_date IS NULL THEN 'PUBLISHED' ELSE 'COMPLETED' END) status,count(*) n
                FROM (""" + ALL + """
                ) e GROUP BY 1 ORDER BY 1""")
                .query((rs, i) -> new StatusCount(rs.getString("status"), rs.getLong("n"))).list();
    }

    /** One publication per listener, so the id alone identifies a row. */
    Optional<Detail> detail(UUID id) {
        return jdbc.sql("""
                SELECT e.id,e.event_type,e.listener_id,
                       coalesce(e.status, CASE WHEN e.completion_date IS NULL THEN 'PUBLISHED' ELSE 'COMPLETED' END) status,
                       e.publication_date::text publication_date,e.completion_date::text completion_date,
                       e.completion_attempts,e.last_resubmission_date::text last_resubmission_date,e.archived,e.serialized_event
                FROM (""" + ALL + ") e WHERE e.id = :id LIMIT 1")
                .param("id", id)
                .query((rs, i) -> new Detail(entry(rs), rs.getString("serialized_event"))).optional();
    }

    private static Entry entry(java.sql.ResultSet rs) throws java.sql.SQLException {
        int attempts = rs.getInt("completion_attempts");
        Integer completionAttempts = rs.wasNull() ? null : attempts;
        return new Entry(rs.getObject("id", UUID.class), rs.getString("event_type"), rs.getString("listener_id"),
                rs.getString("status"), rs.getString("publication_date"), rs.getString("completion_date"),
                completionAttempts, rs.getString("last_resubmission_date"), rs.getBoolean("archived"));
    }
}
