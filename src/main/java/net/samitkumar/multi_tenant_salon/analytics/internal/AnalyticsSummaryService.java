package net.samitkumar.multi_tenant_salon.analytics.internal;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
class AnalyticsSummaryService {

    private static final int TOP_N = 10;

    private final JdbcClient jdbcClient;

    AnalyticsSummaryService(JdbcTemplate jdbcTemplate) {
        this.jdbcClient = JdbcClient.create(jdbcTemplate);
    }

    AnalyticsSummary summarize(UUID salonId, int days) {
        // Bind as OffsetDateTime, not Instant: the PostgreSQL JDBC driver can't infer a SQL type
        // for java.time.Instant on a plain JdbcClient (Spring Data JDBC's own converters don't
        // apply here), and OffsetDateTime maps straight onto the timestamptz column.
        OffsetDateTime since = OffsetDateTime.now(ZoneOffset.UTC).minus(days, ChronoUnit.DAYS);

        long totalViews = countByType(salonId, AnalyticsEventType.PAGE_VIEW, since);
        long totalClicks = countByType(salonId, AnalyticsEventType.CLICK, since);

        var viewsByDay = jdbcClient.sql("""
                        SELECT CAST(occurred_at AS date) AS day, COUNT(*) AS count
                        FROM analytics_event
                        WHERE salon_id = :salonId AND event_type = 'PAGE_VIEW' AND occurred_at >= :since
                        GROUP BY 1 ORDER BY 1
                        """)
                .param("salonId", salonId)
                .param("since", since)
                .query(AnalyticsSummary.DailyCount.class)
                .list();

        var topPages = jdbcClient.sql("""
                        SELECT path, COUNT(*) AS count
                        FROM analytics_event
                        WHERE salon_id = :salonId AND event_type = 'PAGE_VIEW' AND occurred_at >= :since
                        GROUP BY path ORDER BY count DESC LIMIT :limit
                        """)
                .param("salonId", salonId)
                .param("since", since)
                .param("limit", TOP_N)
                .query(AnalyticsSummary.PathCount.class)
                .list();

        var topClicks = jdbcClient.sql("""
                        SELECT label, COUNT(*) AS count
                        FROM analytics_event
                        WHERE salon_id = :salonId AND event_type = 'CLICK' AND label IS NOT NULL AND occurred_at >= :since
                        GROUP BY label ORDER BY count DESC LIMIT :limit
                        """)
                .param("salonId", salonId)
                .param("since", since)
                .param("limit", TOP_N)
                .query(AnalyticsSummary.LabelCount.class)
                .list();

        return new AnalyticsSummary(totalViews, totalClicks, viewsByDay, topPages, topClicks);
    }

    private long countByType(UUID salonId, AnalyticsEventType type, OffsetDateTime since) {
        return jdbcClient.sql("""
                        SELECT COUNT(*) FROM analytics_event
                        WHERE salon_id = :salonId AND event_type = :eventType AND occurred_at >= :since
                        """)
                .param("salonId", salonId)
                .param("eventType", type.name())
                .param("since", since)
                .query(Long.class)
                .single();
    }

    GenUiSummary summarizeGenUi(UUID salonId, int days) {
        OffsetDateTime since = OffsetDateTime.now(ZoneOffset.UTC).minus(days, ChronoUnit.DAYS);

        long totalSessions = jdbcClient.sql("""
                        SELECT COUNT(DISTINCT session_id) FROM genui_event
                        WHERE salon_id = :salonId AND occurred_at >= :since AND session_id IS NOT NULL
                        """)
                .param("salonId", salonId)
                .param("since", since)
                .query(Long.class)
                .single();

        long totalMessages = countGenUiEvents(salonId, "MESSAGE_SENT", since);
        long totalBookingsProposed = countGenUiEvents(salonId, "BOOKING_PROPOSED", since);

        var topComponents = jdbcClient.sql("""
                        SELECT detail AS type, COUNT(*) AS count
                        FROM genui_event
                        WHERE salon_id = :salonId AND event_type = 'COMPONENT_SHOWN' AND occurred_at >= :since
                        GROUP BY detail ORDER BY count DESC LIMIT :limit
                        """)
                .param("salonId", salonId)
                .param("since", since)
                .param("limit", TOP_N)
                .query(GenUiSummary.ComponentCount.class)
                .list();

        var topTools = jdbcClient.sql("""
                        SELECT detail AS tool, COUNT(*) AS count
                        FROM genui_event
                        WHERE salon_id = :salonId AND event_type = 'TOOL_INVOKED' AND occurred_at >= :since
                        GROUP BY detail ORDER BY count DESC LIMIT :limit
                        """)
                .param("salonId", salonId)
                .param("since", since)
                .param("limit", TOP_N)
                .query(GenUiSummary.ToolCount.class)
                .list();

        return new GenUiSummary(totalSessions, totalMessages, totalBookingsProposed, topComponents, topTools);
    }

    private long countGenUiEvents(UUID salonId, String eventType, OffsetDateTime since) {
        return jdbcClient.sql("""
                        SELECT COUNT(*) FROM genui_event
                        WHERE salon_id = :salonId AND event_type = :eventType AND occurred_at >= :since
                        """)
                .param("salonId", salonId)
                .param("eventType", eventType)
                .param("since", since)
                .query(Long.class)
                .single();
    }
}
