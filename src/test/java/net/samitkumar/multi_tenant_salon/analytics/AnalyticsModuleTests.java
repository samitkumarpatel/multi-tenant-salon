package net.samitkumar.multi_tenant_salon.analytics;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.context.WebApplicationContext;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@ApplicationModuleTest(mode = ApplicationModuleTest.BootstrapMode.ALL_DEPENDENCIES)
@Import(TestcontainersConfiguration.class)
class AnalyticsModuleTests {

    @Autowired
    JdbcTemplate jdbcTemplate;

    RestTestClient client;
    UUID salonId;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
        salonId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO salon (id, name, handler, owner_name, owner_email, created_at) VALUES (?, ?, ?, ?, ?, now())",
                salonId, "Analytics Test Salon", "analytics-test-" + salonId.toString().substring(0, 8),
                "Test Owner", "test@analytics.com");
        jdbcTemplate.update("INSERT INTO salon_feature (salon_id, feature) VALUES (?, 'ANALYTICS')", salonId);
    }

    private void insertEvent(String type, String path, String label, Instant when) {
        jdbcTemplate.update("""
                INSERT INTO analytics_event (salon_id, event_type, path, label, session_id, occurred_at, received_at)
                VALUES (?, ?, ?, ?, ?, ?, now())
                """, salonId, type, path, label, "sess-1", Timestamp.from(when));
    }

    @Test
    void summaryReturnsOkWithNoEvents() {
        client.get()
                .uri("/api/salon-admin/{id}/analytics/summary?days=7", salonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.totalViews").isEqualTo(0)
                .jsonPath("$.totalClicks").isEqualTo(0)
                .jsonPath("$.viewsByDay.length()").isEqualTo(0)
                .jsonPath("$.topPages.length()").isEqualTo(0);
    }

    @Test
    void summaryAggregatesViewsAndClicksWithinTheWindow() {
        var now = Instant.now();
        insertEvent("PAGE_VIEW", "/", null, now.minus(1, ChronoUnit.DAYS));
        insertEvent("PAGE_VIEW", "/", null, now.minus(2, ChronoUnit.DAYS));
        insertEvent("PAGE_VIEW", "/services", null, now.minus(1, ChronoUnit.DAYS));
        insertEvent("CLICK", "/", "book-now", now.minus(1, ChronoUnit.DAYS));
        insertEvent("PAGE_VIEW", "/", null, now.minus(30, ChronoUnit.DAYS)); // outside the 7-day window

        client.get()
                .uri("/api/salon-admin/{id}/analytics/summary?days=7", salonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.totalViews").isEqualTo(3)
                .jsonPath("$.totalClicks").isEqualTo(1)
                .jsonPath("$.topPages[0].path").isEqualTo("/")
                .jsonPath("$.topPages[0].count").isEqualTo(2)
                .jsonPath("$.topClicks[0].label").isEqualTo("book-now")
                .jsonPath("$.viewsByDay.length()").isEqualTo(2);
    }

    @Test
    void summaryReturns403WhenSalonHasNotOptedIntoAnalytics() {
        var other = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO salon (id, name, handler, owner_name, owner_email, created_at) VALUES (?, ?, ?, ?, ?, now())",
                other, "No Analytics Salon", "no-analytics-" + other.toString().substring(0, 8),
                "Test Owner", "test2@analytics.com");

        client.get()
                .uri("/api/salon-admin/{id}/analytics/summary?days=7", other)
                .exchange()
                .expectStatus().isForbidden();
    }
}
