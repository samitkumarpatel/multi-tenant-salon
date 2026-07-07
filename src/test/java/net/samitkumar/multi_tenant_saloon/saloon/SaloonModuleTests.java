package net.samitkumar.multi_tenant_saloon.saloon;

import net.samitkumar.multi_tenant_saloon.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.context.WebApplicationContext;

@ApplicationModuleTest
@Import(TestcontainersConfiguration.class)
class SaloonModuleTests {

    RestTestClient client;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
    }

    @Test
    void createSaloon() {
        client.post()
                .uri("/api/saloons")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Glam Saloon",
                            "ownerName": "Jane Doe",
                            "ownerEmail": "jane@glamsaloon.com",
                            "ownerPhone": "+1234567890",
                            "features": ["BOOKING", "STATIC_WEBSITE"]
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.id").isNotEmpty()
                .jsonPath("$.name").isEqualTo("Glam Saloon")
                .jsonPath("$.owner.name").isEqualTo("Jane Doe")
                .jsonPath("$.features").isArray();
    }

    @Test
    void listSaloons() {
        client.get()
                .uri("/api/saloons")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$").isArray();
    }

    @Test
    void saloonNotFound() {
        client.get()
                .uri("/api/saloons/99999")
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void updateFeatures() {
        var created = client.post()
                .uri("/api/saloons")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Style Hub",
                            "ownerName": "John Smith",
                            "ownerEmail": "john@stylehub.com",
                            "ownerPhone": "+9876543210",
                            "features": ["BOOKING"]
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Void.class)
                .returnResult();

        String location = created.getResponseHeaders().getLocation().getPath();
        String id = location.substring(location.lastIndexOf('/') + 1);

        client.put()
                .uri("/api/saloons/" + id + "/features")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "features": ["BOOKING", "MEMBERSHIP", "WEBSHOP"]
                        }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.features.length()").isEqualTo(3);
    }

    @Test
    void deleteSaloon() {
        var created = client.post()
                .uri("/api/saloons")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Temp Saloon",
                            "ownerName": "Alice",
                            "ownerEmail": "alice@temp.com",
                            "ownerPhone": "+1111111111",
                            "features": []
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Void.class)
                .returnResult();

        String location = created.getResponseHeaders().getLocation().getPath();
        String id = location.substring(location.lastIndexOf('/') + 1);

        client.delete()
                .uri("/api/saloons/" + id)
                .exchange()
                .expectStatus().isNoContent();

        client.get()
                .uri("/api/saloons/" + id)
                .exchange()
                .expectStatus().isNotFound();
    }
}
