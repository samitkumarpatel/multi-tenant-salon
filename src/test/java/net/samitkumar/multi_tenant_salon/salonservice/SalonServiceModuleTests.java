package net.samitkumar.multi_tenant_salon.salonservice;

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
class SalonServiceModuleTests {

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
                salonId, "Service Test Salon", "svc-test-" + salonId.toString().substring(0, 8),
                "Test Owner", "test@svc.com");
    }

    @Test
    void listServicesReturnsEmptyInitially() {
        client.get()
                .uri("/api/salon-admin/{id}/services", salonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$").isArray()
                .jsonPath("$.length()").isEqualTo(0);
    }

    @Test
    void addService() {
        client.post()
                .uri("/api/salon-admin/{id}/services", salonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Haircut",
                            "description": "Classic haircut",
                            "price": 25.00,
                            "currency": "USD",
                            "durationMinutes": 30,
                            "category": "HAIR"
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.id").isNotEmpty()
                .jsonPath("$.name").isEqualTo("Haircut")
                .jsonPath("$.category").isEqualTo("HAIR")
                .jsonPath("$.active").isEqualTo(true)
                .jsonPath("$.durationMinutes").isEqualTo(30);
    }

    @Test
    void serviceLifecycle() {
        var created = client.post()
                .uri("/api/salon-admin/{id}/services", salonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Manicure",
                            "price": 35.00,
                            "currency": "USD",
                            "durationMinutes": 45,
                            "category": "NAILS"
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Void.class)
                .returnResult();

        String location = created.getResponseHeaders().getLocation().getPath();
        String serviceId = location.substring(location.lastIndexOf('/') + 1);

        client.get()
                .uri("/api/salon-admin/{salonId}/services/{serviceId}", salonId, serviceId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.name").isEqualTo("Manicure")
                .jsonPath("$.price").isEqualTo(35.00);

        client.put()
                .uri("/api/salon-admin/{salonId}/services/{serviceId}", salonId, serviceId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Deluxe Manicure",
                            "price": 45.00,
                            "currency": "USD",
                            "durationMinutes": 60,
                            "category": "NAILS",
                            "active": true
                        }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.name").isEqualTo("Deluxe Manicure")
                .jsonPath("$.price").isEqualTo(45.00);

        client.get()
                .uri("/api/salon-admin/{salonId}/services", salonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.length()").isEqualTo(1);

        client.delete()
                .uri("/api/salon-admin/{salonId}/services/{serviceId}", salonId, serviceId)
                .exchange()
                .expectStatus().isNoContent();

        client.get()
                .uri("/api/salon-admin/{salonId}/services/{serviceId}", salonId, serviceId)
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void serviceNotFound() {
        client.get()
                .uri("/api/salon-admin/{salonId}/services/99999", salonId)
                .exchange()
                .expectStatus().isNotFound();
    }
}
