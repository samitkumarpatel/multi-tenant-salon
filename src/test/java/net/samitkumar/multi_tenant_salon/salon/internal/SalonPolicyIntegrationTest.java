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
class SalonPolicyIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @MockitoBean JwtDecoder decoder;
    @Value("${local.server.port}") int port;
    RestTestClient client;
    UUID salonId;
    String adminPath;

    @BeforeEach void setup() {
        salonId = UUID.randomUUID();
        jdbc.update("INSERT INTO salon(id, name, handler, created_at) VALUES (?, 'Policy test', ?, now())",
                salonId, "policy-" + salonId);
        adminPath = "/api/salon-admin/" + salonId + "/policies";
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        when(decoder.decode(anyString())).thenAnswer(invocation -> {
            String token = invocation.getArgument(0);
            String role = token.equals("staff") ? "STAFF" : "OWNER";
            return Jwt.withTokenValue(token).header("alg", "RS256").subject(token)
                    .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300))
                    .claim("roles", List.of(role)).claim("salons", List.of(Map.of("salonId",
                            token.equals("other") ? UUID.randomUUID().toString() : salonId.toString(),
                            "role", role, "active", true))).build();
        });
    }

    private Map<String, Object> policy() {
        return Map.of("key", "privacy", "title", "Privacy information", "enabled", true,
                "website", true, "booking", false, "source", "CUSTOM", "defaultLanguage", "en",
                "translations", Map.of("en", "This salon's privacy text.", "da", "Salonens privatlivstekst."));
    }

    @Test void keepsDraftsPrivateUntilPublishingAndFiltersByPlacementAndSalon() {
        String publicPath = "/api/salon/" + salonId + "/policies";
        client.get().uri(adminPath).header("Authorization", "Bearer owner").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$[0].source").isEqualTo("DEFAULT");
        client.get().uri(publicPath + "?placement=website").exchange().expectStatus().isOk()
                .expectHeader().valueEquals("Cache-Control", "no-store")
                .expectBody().json("[]");

        client.put().uri(adminPath).header("Authorization", "Bearer owner").contentType(MediaType.APPLICATION_JSON)
                .body(List.of(policy())).exchange().expectStatus().isOk();
        client.get().uri(publicPath + "?placement=website").exchange().expectStatus().isOk()
                .expectBody().json("[]");

        client.post().uri(adminPath + "/publish").header("Authorization", "Bearer owner")
                .exchange().expectStatus().isOk();
        client.get().uri(publicPath + "?placement=website").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$[0].title").isEqualTo("Privacy information")
                .jsonPath("$[0].translations.da").isEqualTo("Salonens privatlivstekst.");
        client.get().uri(publicPath + "?placement=booking").exchange().expectStatus().isOk()
                .expectBody().json("[]");

        UUID anotherSalon = UUID.randomUUID();
        jdbc.update("INSERT INTO salon(id, name, handler, created_at) VALUES (?, 'Other policy salon', ?, now())",
                anotherSalon, "policy-" + anotherSalon);
        client.get().uri("/api/salon/" + anotherSalon + "/policies?placement=website").exchange()
                .expectStatus().isOk().expectBody().json("[]");
    }

    @Test void validatesPlacementAndRestrictsDraftManagementToSalonOwners() {
        String publicPath = "/api/salon/" + salonId + "/policies";
        client.get().uri(publicPath + "?placement=staff").exchange().expectStatus().isBadRequest();
        client.put().uri(adminPath).contentType(MediaType.APPLICATION_JSON).body(List.of(policy()))
                .exchange().expectStatus().isUnauthorized();
        for (String token : List.of("other", "staff")) {
            client.put().uri(adminPath).header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON).body(List.of(policy()))
                    .exchange().expectStatus().isForbidden();
        }
        var invalid = Map.of("key", "Bad Key", "title", "Invalid", "enabled", true,
                "website", true, "booking", false, "source", "CUSTOM", "defaultLanguage", "en",
                "translations", Map.of("en", "Text"));
        client.put().uri(adminPath).header("Authorization", "Bearer owner")
                .contentType(MediaType.APPLICATION_JSON).body(List.of(invalid)).exchange().expectStatus().isBadRequest();
    }
}
