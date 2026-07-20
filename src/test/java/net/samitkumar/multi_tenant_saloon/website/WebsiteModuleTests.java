package net.samitkumar.multi_tenant_saloon.website;

import net.samitkumar.multi_tenant_saloon.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

@ApplicationModuleTest
@Import(TestcontainersConfiguration.class)
class WebsiteModuleTests {

    @Autowired
    JdbcTemplate jdbcTemplate;

    RestTestClient client;
    UUID saloonId;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
        saloonId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO saloon (id, name, handler, owner_name, owner_email, created_at) VALUES (?, ?, ?, ?, ?, now())",
                saloonId, "Theme Test Saloon", "theme-test-" + saloonId.toString().substring(0, 8),
                "Test Owner", "test@theme.com");
    }

    @Test
    void getThemeReturnsDefaultsWhenNotSet() {
        client.get()
                .uri("/api/saloon/{id}/website", saloonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.saloonId").isEqualTo(saloonId.toString())
                .jsonPath("$.websiteType").isEqualTo("STATIC_WEBSITE");
    }

    @Test
    void getWebsiteTypeReturnsDefaultWhenNotSet() {
        client.get()
                .uri("/api/saloon-admin/{id}/website-type", saloonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.websiteType").isEqualTo("STATIC_WEBSITE");
    }

    @Test
    void updateAndGetWebsiteType() {
        client.patch()
                .uri("/api/saloon-admin/{id}/website-type", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "websiteType": "GENERATIVE_UI" }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.websiteType").isEqualTo("GENERATIVE_UI");

        client.get()
                .uri("/api/saloon-admin/{id}/website-type", saloonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.websiteType").isEqualTo("GENERATIVE_UI");
    }

    @Test
    void saveAndRetrieveTheme() {
        client.put()
                .uri("/api/saloon-admin/{id}/website", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "heroBg": "#1A1A2E",
                            "heroTextColor": "#E0E0E0",
                            "accentColor": "#E94560",
                            "fontFamily": "roboto",
                            "logoBgColor": "#0F3460"
                        }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.heroBg").isEqualTo("#1A1A2E")
                .jsonPath("$.accentColor").isEqualTo("#E94560")
                .jsonPath("$.fontFamily").isEqualTo("roboto")
                .jsonPath("$.updatedAt").isNotEmpty();

        client.get()
                .uri("/api/saloon/{id}/website", saloonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.heroBg").isEqualTo("#1A1A2E")
                .jsonPath("$.fontFamily").isEqualTo("roboto");
    }

    @Test
    void saveThemeIsIdempotent() {
        var body = """
                {
                    "heroBg": "#FFFFFF",
                    "heroTextColor": "#000000",
                    "accentColor": "#FF0000",
                    "fontFamily": "poppins",
                    "logoBgColor": "#0000FF"
                }
                """;

        client.put()
                .uri("/api/saloon-admin/{id}/website", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .exchange()
                .expectStatus().isOk();

        client.put()
                .uri("/api/saloon-admin/{id}/website", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.fontFamily").isEqualTo("poppins");
    }
}
