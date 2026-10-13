package net.samitkumar.multi_tenant_salon.analytics.internal;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.util.UUID;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.flyway.enabled=true", "spring.sql.init.mode=never"
})
@Import(TestcontainersConfiguration.class)
class PlatformStatsIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Value("${local.server.port}") int port;

    @Test void exposesOnlyRealAggregateCountsWithoutAuthentication() {
        var first = UUID.randomUUID();
        var second = UUID.randomUUID();
        var blank = UUID.randomUUID();
        long salonsBefore = count("SELECT COUNT(*) FROM salon");
        long countriesBefore = count("SELECT COUNT(DISTINCT LOWER(TRIM(country))) FROM salon WHERE NULLIF(TRIM(country), '') IS NOT NULL");
        String country = "test-" + first;
        try {
            for (var id : new UUID[]{first, second, blank}) {
                jdbc.update("INSERT INTO salon(id, name, handler, country, created_at) VALUES (?, 'Stats test', ?, ?, now())",
                        id, "stats-" + id, id.equals(blank) ? "  " : id.equals(first) ? country : " " + country.toUpperCase() + " ");
            }
            RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build()
                    .get().uri("/api/salon-onboarding/stats").exchange().expectStatus().isOk()
                    .expectHeader().valueEquals("Cache-Control", "max-age=300, public")
                    .expectBody().json("""
                            {"salonsOnboarded": %d, "bookingsCreated": %d, "countriesRepresented": %d}
                            """.formatted(salonsBefore + 3, count("SELECT COUNT(*) FROM booking"), countriesBefore + 1))
                    .jsonPath("$.owner").doesNotExist().jsonPath("$.salons").doesNotExist();
        } finally {
            for (var id : new UUID[]{first, second, blank}) jdbc.update("DELETE FROM salon WHERE id = ?", id);
        }
    }

    private long count(String sql) { return jdbc.queryForObject(sql, Long.class); }
}
