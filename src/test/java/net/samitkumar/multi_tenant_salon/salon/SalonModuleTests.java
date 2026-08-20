package net.samitkumar.multi_tenant_salon.salon;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.context.WebApplicationContext;

@ApplicationModuleTest(extraIncludes = "utility")
@Import(TestcontainersConfiguration.class)
class SalonModuleTests {

    RestTestClient client;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
    }

    @Test
    void createSalon() {
        client.post()
                .uri("/api/salon-onboarding")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Glam Salon",
                            "ownerName": "Jane Doe",
                            "ownerEmail": "jane@glamsalon.com",
                            "ownerPhone": "+1234567890",
                            "features": ["BOOKING", "STATIC_WEBSITE"],
                            "termsAccepted": true
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.salonId").isNotEmpty()
                .jsonPath("$.salonHandler").isEqualTo("glam-salon")
                .jsonPath("$.emailId").isEqualTo("jane@glamsalon.com")
                .jsonPath("$.message").isNotEmpty();
    }

    @Test
    void createSalonValidation() {
        client.post()
                .uri("/api/salon-onboarding")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "ownerPhone": "+1234567890"
                        }
                        """)
                .exchange()
                .expectStatus().isBadRequest();
    }

    @Test
    void listSalons() {
        client.get()
                .uri("/api/salon-onboarding")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$").isArray();
    }

    @Test
    void salonNotFound() {
        client.get()
                .uri("/api/salon/00000000-0000-0000-0000-000000000000")
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    void updateFeatures() {
        var created = client.post()
                .uri("/api/salon-onboarding")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Style Hub",
                            "ownerName": "John Smith",
                            "ownerEmail": "john@stylehub.com",
                            "ownerPhone": "+9876543210",
                            "features": ["BOOKING"],
                            "termsAccepted": true
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Void.class)
                .returnResult();

        String location = created.getResponseHeaders().getLocation().getPath();
        String id = location.substring(location.lastIndexOf('/') + 1);

        client.put()
                .uri("/api/salon-admin/" + id + "/features")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        ["BOOKING", "MEMBERSHIP", "WEBSHOP"]
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.features.length()").isEqualTo(3);
    }

    @Test
    void getSalonByHandler() {
        var created = client.post()
                .uri("/api/salon-onboarding")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Handler Test",
                            "ownerName": "Bob",
                            "ownerEmail": "bob@test.com",
                            "termsAccepted": true
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.salonHandler").value(handler -> {
                    client.get()
                            .uri("/api/salon/" + handler)
                            .exchange()
                            .expectStatus().isOk()
                            .expectBody()
                            .jsonPath("$.name").isEqualTo("Handler Test");
                });
    }

    @Test
    void updateSalon() {
        var created = client.post()
                .uri("/api/salon-onboarding")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Old Name",
                            "ownerName": "Carol",
                            "ownerEmail": "carol@test.com",
                            "termsAccepted": true
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Void.class)
                .returnResult();

        String location = created.getResponseHeaders().getLocation().getPath();
        String id = location.substring(location.lastIndexOf('/') + 1);

        client.put()
                .uri("/api/salon-admin/" + id)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "New Name"
                        }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.name").isEqualTo("New Name");
    }

    @Test
    void deleteSalon() {
        var created = client.post()
                .uri("/api/salon-onboarding")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                            "name": "Temp Salon",
                            "ownerName": "Alice",
                            "ownerEmail": "alice@temp.com",
                            "ownerPhone": "+1111111111",
                            "features": [],
                            "termsAccepted": true
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody(Void.class)
                .returnResult();

        String location = created.getResponseHeaders().getLocation().getPath();
        String id = location.substring(location.lastIndexOf('/') + 1);

        client.delete()
                .uri("/api/salon-admin/" + id)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("DISABLED");

        client.get()
                .uri("/api/salon/" + id)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.status").isEqualTo("DISABLED");
    }
}
