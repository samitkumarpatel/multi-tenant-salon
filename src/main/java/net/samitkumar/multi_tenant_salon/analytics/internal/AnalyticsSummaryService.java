package net.samitkumar.multi_tenant_salon.analytics.internal;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.time.Instant;
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
        Instant since = Instant.now().minus(days, ChronoUnit.DAYS);

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

    private long countByType(UUID salonId, AnalyticsEventType type, Instant since) {
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
}
