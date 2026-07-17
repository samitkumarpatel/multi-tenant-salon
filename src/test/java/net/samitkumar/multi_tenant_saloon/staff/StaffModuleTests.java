package net.samitkumar.multi_tenant_saloon.staff;

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
class StaffModuleTests {

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
                saloonId, "Staff Test Saloon", "staff-test-" + saloonId.toString().substring(0, 8),
                "Test Owner", "test@staff.com");
    }

    @Test
    void listStaffReturnsEmptyInitially() {
        client.get()
                .uri("/api/saloon-admin/{id}/staff", saloonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$").isArray()
                .jsonPath("$.length()").isEqualTo(0);
    }

    @Test
    void onboardStaff() {
        client.post()
                .uri("/api/saloon-admin/{id}/staff", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Alice Johnson",
                            "email": "alice@salon.com",
                            "phone": "+1234567890",
                            "role": "STYLIST",
                            "specializations": ["coloring", "balayage"]
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.id").isNotEmpty()
                .jsonPath("$.name").isEqualTo("Alice Johnson")
                .jsonPath("$.role").isEqualTo("STYLIST")
                .jsonPath("$.status").isEqualTo("ACTIVE")
                .jsonPath("$.specializations.length()").isEqualTo(2);
    }

    @Test
    void staffLifecycle() {
        var created = client.post()
                .uri("/api/saloon-admin/{id}/staff", saloonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Bob Smith",
                            "email": "bob@salon.com",
                            "role": "COLORIST"
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Void.class)
                .returnResult();

        String location = created.getResponseHeaders().getLocation().getPath();
        String staffId = location.substring(location.lastIndexOf('/') + 1);

        client.get()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}", saloonId, staffId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.name").isEqualTo("Bob Smith")
                .jsonPath("$.role").isEqualTo("COLORIST")
                .jsonPath("$.status").isEqualTo("ACTIVE");

        client.put()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}", saloonId, staffId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Bob Smith",
                            "email": "bob@salon.com",
                            "role": "MANAGER",
                            "status": "ACTIVE",
                            "specializations": ["management"]
                        }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.role").isEqualTo("MANAGER")
                .jsonPath("$.specializations.length()").isEqualTo(1);

        client.get()
                .uri("/api/saloon-admin/{saloonId}/staff", saloonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1);

        client.delete()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}", saloonId, staffId)
                .exchange()
                .expectStatus().isNoContent();

        client.get()
                .uri("/api/saloon-admin/{saloonId}/staff/{staffId}", saloonId, staffId)
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void staffNotFound() {
        client.get()
                .uri("/api/saloon-admin/{saloonId}/staff/99999", saloonId)
                .exchange()
                .expectStatus().isNotFound();
    }
}
