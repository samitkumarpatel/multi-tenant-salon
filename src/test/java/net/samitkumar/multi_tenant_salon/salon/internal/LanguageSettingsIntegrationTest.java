package net.samitkumar.multi_tenant_salon.salon.internal;

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
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.flyway.enabled=true", "spring.sql.init.mode=never",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://auth.test"
})
@Import(TestcontainersConfiguration.class)
class LanguageSettingsIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @MockitoBean JwtDecoder decoder;
    @Value("${local.server.port}") int port;
    RestTestClient client;
    UUID salonId;
    String handler;
    String adminPath;

    @BeforeEach void setup() {
        salonId = UUID.randomUUID();
        handler = "languages-" + salonId;
        jdbc.update("INSERT INTO salon(id, name, handler, created_at) VALUES (?, 'Language test', ?, now())", salonId, handler);
        adminPath = "/api/salon-admin/" + salonId + "/languages";
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        when(decoder.decode(anyString())).thenAnswer(invocation -> {
            String token = invocation.getArgument(0);
            String role = token.equals("staff") ? "STAFF" : "OWNER";
            return Jwt.withTokenValue(token).header("alg", "RS256").subject(token)
                    .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300))
                    .claim("roles", List.of(role)).claim("salons", List.of(Map.of("salonId",
                            token.equals("other") ? UUID.randomUUID().toString() : salonId.toString(),
                            "role", role, "active", !token.equals("inactive")))).build();
        });
    }

    private Map<String, Object> policy(List<String> enabled, String defaultLanguage) {
        return Map.of("enabled", enabled, "defaultLanguage", defaultLanguage);
    }

    private Map<String, Object> settings(Object website) {
        return Map.of("website", website, "booking", policy(List.of("nb", "sv"), "nb"),
                "dashboard", policy(List.of("de", "fr"), "de"));
    }

    @Test void defaultsToEnglishAndPublishesIndependentPoliciesByIdAndHandler() {
        client.get().uri("/api/salon/" + handler + "/languages").exchange().expectStatus().isOk()
                .expectHeader().valueEquals("Cache-Control", "no-store")
                .expectBody().jsonPath("$.website.enabled[0]").isEqualTo("en")
                .jsonPath("$.booking.defaultLanguage").isEqualTo("en")
                .jsonPath("$.dashboard.defaultLanguage").isEqualTo("en");
        client.put().uri(adminPath).header("Authorization", "Bearer owner").contentType(MediaType.APPLICATION_JSON)
                .body(settings(policy(List.of("en", "da"), "da"))).exchange().expectStatus().isOk();
        for (String id : List.of(salonId.toString(), handler)) {
            client.get().uri("/api/salon/" + id + "/languages").exchange().expectStatus().isOk()
                    .expectBody().jsonPath("$.website.defaultLanguage").isEqualTo("da")
                    .jsonPath("$.booking.enabled[0]").isEqualTo("nb")
                    .jsonPath("$.dashboard.defaultLanguage").isEqualTo("de");
        }
        // Publishing a replacement removes languages, rather than merging stale choices.
        client.put().uri(adminPath).header("Authorization", "Bearer owner").contentType(MediaType.APPLICATION_JSON)
                .body(settings(policy(List.of("fr"), "fr"))).exchange().expectStatus().isOk();
        client.get().uri("/api/salon/" + salonId + "/languages").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.website.enabled.length()").isEqualTo(1)
                .jsonPath("$.website.defaultLanguage").isEqualTo("fr");
    }

    @Test void rejectsInvalidPoliciesWithoutSavingOtherApplications() {
        for (var invalid : List.of(policy(List.of(), "en"), policy(List.of("es"), "es"),
                policy(List.of("en", "en"), "en"), policy(List.of("en"), "da"))) {
            client.put().uri(adminPath).header("Authorization", "Bearer owner").contentType(MediaType.APPLICATION_JSON)
                    .body(settings(invalid)).exchange().expectStatus().isBadRequest();
        }
        client.put().uri(adminPath).header("Authorization", "Bearer owner").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("website", policy(List.of("da"), "da"))).exchange().expectStatus().isBadRequest();
        client.get().uri("/api/salon/" + salonId + "/languages").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.booking.defaultLanguage").isEqualTo("en");
    }

    @Test void onlyActiveSalonOwnersCanPublish() {
        client.put().uri(adminPath).contentType(MediaType.APPLICATION_JSON)
                .body(settings(policy(List.of("da"), "da"))).exchange().expectStatus().isUnauthorized();
        for (String token : List.of("other", "staff", "inactive")) {
            client.put().uri(adminPath).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                    .body(settings(policy(List.of("da"), "da"))).exchange().expectStatus().isForbidden();
        }
    }
}
