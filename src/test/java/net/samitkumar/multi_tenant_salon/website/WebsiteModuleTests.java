package net.samitkumar.multi_tenant_salon.website;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
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
    UUID salonId;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
        salonId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO salon (id, name, handler, owner_name, owner_email, created_at) VALUES (?, ?, ?, ?, ?, now())",
                salonId, "Theme Test Salon", "theme-test-" + salonId.toString().substring(0, 8),
                "Test Owner", "test@theme.com");
    }

    @Test
    void getThemeReturnsDefaultsWhenNotSet() {
        client.get()
                .uri("/api/salon/{id}/website", salonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.salonId").isEqualTo(salonId.toString())
                .jsonPath("$.websiteType").isEqualTo("STATIC_WEBSITE");
    }

    @Test
    void getWebsiteTypeReturnsDefaultWhenNotSet() {
        client.get()
                .uri("/api/salon-admin/{id}/website-type", salonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.websiteType").isEqualTo("STATIC_WEBSITE");
    }

    @Test
    void updateAndGetWebsiteType() {
        client.patch()
                .uri("/api/salon-admin/{id}/website-type", salonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "websiteType": "GENERATIVE_UI" }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.websiteType").isEqualTo("GENERATIVE_UI");

        client.get()
                .uri("/api/salon-admin/{id}/website-type", salonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.websiteType").isEqualTo("GENERATIVE_UI");
    }

    @Test
    void saveAndRetrieveTheme() {
        client.put()
                .uri("/api/salon-admin/{id}/website", salonId)
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
                .uri("/api/salon/{id}/website", salonId)
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
                .uri("/api/salon-admin/{id}/website", salonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .exchange()
                .expectStatus().isOk();

        client.put()
                .uri("/api/salon-admin/{id}/website", salonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.fontFamily").isEqualTo("poppins");
    }
}
