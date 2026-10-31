package net.samitkumar.multi_tenant_salon.superadmin;

import com.jayway.jsonpath.JsonPath;
import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.flyway.enabled=true", "spring.sql.init.mode=never", "app.security.permit-all=false",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://auth.test"})
@Import({TestcontainersConfiguration.class, EventFailureRecordingIntegrationTest.FailingListener.class})
class EventFailureRecordingIntegrationTest {
    record ProbeEvent(String id) {}

    @TestConfiguration(proxyBeanMethods = false)
    static class FailingListener {
        @Bean FailingProbe failingProbe() { return new FailingProbe(); }
    }
    static class FailingProbe {
        @ApplicationModuleListener
        void on(ProbeEvent event) { throw new IllegalStateException("probe failed for " + event.id()); }
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired ApplicationEventPublisher events;
    @Autowired TransactionTemplate tx;
    @MockitoBean JwtDecoder decoder;
    @Value("${local.server.port}") int port;

    @Test void aFailedListenerLeavesItsReasonOnThePublication() {
        String admin = "admin-" + UUID.randomUUID().toString().substring(0, 8) + "@events.test", id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO super_admin(email,active) VALUES(?,true)", admin);
        String token = UUID.randomUUID().toString();
        when(decoder.decode(anyString())).thenReturn(Jwt.withTokenValue(token).header("alg", "RS256").subject(admin)
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(600)).claim("roles", List.of("SUPER_ADMIN")).build());

        tx.executeWithoutResult(s -> events.publishEvent(new ProbeEvent(id)));

        await().atMost(Duration.ofSeconds(20)).untilAsserted(() -> assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM event_publication_failure WHERE message LIKE ?", Integer.class, "%" + id)).isPositive());
        var row = jdbc.queryForMap("SELECT publication_id, error_class, stack_trace FROM event_publication_failure WHERE message LIKE ? ORDER BY id LIMIT 1", "%" + id);
        assertThat(row.get("publication_id")).as("tied to the stored publication").isNotNull();
        assertThat(row.get("error_class")).isEqualTo("java.lang.IllegalStateException");
        assertThat((String) row.get("stack_trace")).contains("probe failed for " + id);

        var client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        var json = client.get().uri("/api/salon-super-admin/events/" + row.get("publication_id")).header("Authorization", "Bearer " + token)
                .exchange().expectStatus().isOk().expectBody(String.class).returnResult().getResponseBody();
        assertThat(JsonPath.<String>read(json, "$.failures[0].message")).isEqualTo("probe failed for " + id);
        assertThat(JsonPath.<String>read(json, "$.entry.lastError")).isEqualTo("probe failed for " + id);
    }

    @Test void aFailedPublicationCanBeResubmittedByHand() {
        String admin = "admin-" + UUID.randomUUID().toString().substring(0, 8) + "@events.test", id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO super_admin(email,active) VALUES(?,true)", admin);
        String token = UUID.randomUUID().toString();
        when(decoder.decode(anyString())).thenReturn(Jwt.withTokenValue(token).header("alg", "RS256").subject(admin)
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(600)).claim("roles", List.of("SUPER_ADMIN")).build());
        tx.executeWithoutResult(s -> events.publishEvent(new ProbeEvent(id)));
        await().atMost(Duration.ofSeconds(20)).untilAsserted(() -> assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM event_publication WHERE status='FAILED' AND serialized_event LIKE ?", Integer.class, "%" + id + "%")).isPositive());
        UUID publication = jdbc.queryForObject("SELECT id FROM event_publication WHERE serialized_event LIKE ?", UUID.class, "%" + id + "%");
        var client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();

        client.post().uri("/api/salon-super-admin/events/" + publication + "/resubmit").header("Authorization", "Bearer " + token)
                .exchange().expectStatus().isAccepted();
        await().atMost(Duration.ofSeconds(20)).untilAsserted(() -> assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM event_publication_failure WHERE publication_id=?", Integer.class, publication)).isGreaterThanOrEqualTo(2));

        client.post().uri("/api/salon-super-admin/events/" + UUID.randomUUID() + "/resubmit").header("Authorization", "Bearer " + token)
                .exchange().expectStatus().isNotFound();
        UUID archived = UUID.randomUUID();
        jdbc.update("INSERT INTO event_publication_archive(id,listener_id,event_type,serialized_event,publication_date,completion_date,status) VALUES(?,'l',?,'{}',now(),now(),'COMPLETED')", archived, "t.Done");
        client.post().uri("/api/salon-super-admin/events/" + archived + "/resubmit").header("Authorization", "Bearer " + token)
                .exchange().expectStatus().isEqualTo(409);
    }
}
