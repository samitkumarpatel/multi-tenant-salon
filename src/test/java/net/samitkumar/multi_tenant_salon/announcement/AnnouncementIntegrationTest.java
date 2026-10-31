package net.samitkumar.multi_tenant_salon.announcement;

import com.jayway.jsonpath.JsonPath;
import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.client.RestTestClient;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.flyway.enabled=true", "spring.sql.init.mode=never", "app.security.permit-all=false",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://auth.test"})
@Import(TestcontainersConfiguration.class)
class AnnouncementIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @MockitoBean JwtDecoder decoder;
    @Value("${local.server.port}") int port;
    RestTestClient client;
    String admin;
    final Map<String, Jwt> tokens = new java.util.concurrent.ConcurrentHashMap<>();

    @BeforeEach void setup() {
        jdbc.update("DELETE FROM announcement");
        admin = "admin-" + UUID.randomUUID().toString().substring(0, 8) + "@announce.test";
        jdbc.update("INSERT INTO super_admin(email,active) VALUES(?,true)", admin);
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        when(decoder.decode(anyString())).thenAnswer(inv -> tokens.get(inv.getArgument(0)));
    }
    String token(String email, String role) {
        String id = UUID.randomUUID().toString();
        tokens.put(id, Jwt.withTokenValue(id).header("alg", "RS256").subject(email).issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(600))
                .claim("roles", List.of(role)).build());
        return "Bearer " + id;
    }
    Map<String, Object> body(String title, String audience, String severity) {
        return new HashMap<>(Map.of("title", title, "message", "Details", "severity", severity, "audience", audience));
    }
    String publicTitles(String query) {
        return client.get().uri("/api/public/announcements" + query).exchange().expectStatus().isOk()
                .expectBody(String.class).returnResult().getResponseBody();
    }

    @Test void ownersSeeBothAudiencesOtherAppsOnlyTheGlobalOnes() {
        String auth = token(admin, "SUPER_ADMIN");
        for (var b : List.of(body("owners-only", "SALON_OWNERS", "INFO"), body("everyone", "ALL_APPS", "CRITICAL")))
            client.post().uri("/api/salon-super-admin/announcements").header("Authorization", auth)
                    .contentType(MediaType.APPLICATION_JSON).body(b).exchange().expectStatus().isCreated();
        assertThat(JsonPath.<List<String>>read(publicTitles("?audience=SALON_OWNERS"), "$[*].title")).containsExactly("everyone", "owners-only");
        assertThat(JsonPath.<List<String>>read(publicTitles(""), "$[*].title")).containsExactly("everyone");
    }

    @Test void scheduledEndedAndSwitchedOffAreHiddenAndEditingToggles() {
        String auth = token(admin, "SUPER_ADMIN");
        var future = body("future", "ALL_APPS", "INFO"); future.put("startsAt", Instant.now().plusSeconds(3600).toString());
        var ended = body("ended", "ALL_APPS", "INFO"); ended.put("startsAt", Instant.now().minusSeconds(7200).toString()); ended.put("endsAt", Instant.now().minusSeconds(3600).toString());
        var off = body("off", "ALL_APPS", "INFO"); off.put("active", false);
        for (var b : List.of(future, ended, off))
            client.post().uri("/api/salon-super-admin/announcements").header("Authorization", auth)
                    .contentType(MediaType.APPLICATION_JSON).body(b).exchange().expectStatus().isCreated();
        assertThat(JsonPath.<List<String>>read(publicTitles(""), "$[*].title")).isEmpty();
        var created = client.post().uri("/api/salon-super-admin/announcements").header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).body(body("live", "ALL_APPS", "WARNING")).exchange().expectStatus().isCreated()
                .expectBody(String.class).returnResult().getResponseBody();
        int id = JsonPath.read(created, "$.id");
        assertThat(JsonPath.<List<String>>read(publicTitles(""), "$[*].title")).containsExactly("live");
        var edit = body("live", "ALL_APPS", "WARNING"); edit.put("active", false);
        client.put().uri("/api/salon-super-admin/announcements/" + id).header("Authorization", auth)
                .contentType(MediaType.APPLICATION_JSON).body(edit).exchange().expectStatus().isOk();
        assertThat(JsonPath.<List<String>>read(publicTitles(""), "$[*].title")).isEmpty();
        client.delete().uri("/api/salon-super-admin/announcements/" + id).header("Authorization", auth).exchange().expectStatus().isNoContent();
        client.delete().uri("/api/salon-super-admin/announcements/" + id).header("Authorization", auth).exchange().expectStatus().isNotFound();
    }

    @Test void validationAndAccessAreEnforced() {
        String auth = token(admin, "SUPER_ADMIN");
        var inverted = body("bad window", "ALL_APPS", "INFO");
        inverted.put("startsAt", Instant.now().plusSeconds(100).toString()); inverted.put("endsAt", Instant.now().toString());
        client.post().uri("/api/salon-super-admin/announcements").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON).body(inverted).exchange().expectStatus().isBadRequest();
        client.post().uri("/api/salon-super-admin/announcements").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON).body(body("x", "NOBODY", "INFO")).exchange().expectStatus().isBadRequest();
        var js = body("js link", "ALL_APPS", "INFO"); js.put("linkUrl", "javascript:alert(1)");
        client.post().uri("/api/salon-super-admin/announcements").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON).body(js).exchange().expectStatus().isBadRequest();
        String owner = token("owner@announce.test", "OWNER");
        client.get().uri("/api/salon-super-admin/announcements").header("Authorization", owner).exchange().expectStatus().isForbidden();
        client.post().uri("/api/salon-super-admin/announcements").header("Authorization", owner).contentType(MediaType.APPLICATION_JSON).body(body("x", "ALL_APPS", "INFO")).exchange().expectStatus().isForbidden();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM announcement", Integer.class)).isZero();
    }
}
