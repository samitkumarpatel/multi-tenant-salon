package net.samitkumar.multi_tenant_salon.shop;

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

@ApplicationModuleTest(mode = ApplicationModuleTest.BootstrapMode.ALL_DEPENDENCIES)
@Import(TestcontainersConfiguration.class)
class ShopModuleTests {

    @Autowired
    JdbcTemplate jdbcTemplate;

    RestTestClient client;
    UUID salonId;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
        salonId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO salon (id, name, handler, owner_name, owner_email, contact_email, contact_phone, created_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, now())",
                salonId, "Shop Test Salon", "shop-test-" + salonId.toString().substring(0, 8),
                "Test Owner", "owner@shop.test", "salon@shop.test", "+100000000");
    }

    private final String adminBase() { return "/api/salon-admin/" + salonId + "/shop"; }
    private final String customerBase() { return "/api/salon/" + salonId + "/shop"; }

    // ── Brands & categories ─────────────────────────────────────────────────

    @Test
    void brandLifecycle() {
        var res = client.post().uri(adminBase() + "/brands")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "name": "Kerastase", "description": "Premium hair care" }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.id").isNotEmpty()
                .jsonPath("$.name").isEqualTo("Kerastase")
                .jsonPath("$.active").isEqualTo(true)
                .returnResult();

        var brandId = jsonLong(res.getResponseBody(), "$.id");

        client.get().uri(adminBase() + "/brands").exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.length()").isEqualTo(1);

        client.put().uri(adminBase() + "/brands/" + brandId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "name": "Kérastase", "active": false }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.name").isEqualTo("Kérastase").jsonPath("$.active").isEqualTo(false);

        client.delete().uri(adminBase() + "/brands/" + brandId).exchange().expectStatus().isNoContent();
        client.get().uri(adminBase() + "/brands").exchange()
                .expectStatus().isOk().expectBody().jsonPath("$.length()").isEqualTo(0);
    }

    @Test
    void brandNameRequired() {
        client.post().uri(adminBase() + "/brands")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"description\": \"no name\" }")
                .exchange()
                .expectStatus().isBadRequest();
    }

    // ── Products + variants + inventory ────────────────────────────────────

    @Test
    void productWithVariantsThenInventory() {
        var created = client.post().uri(adminBase() + "/products")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                          "name": "Nourishing Shampoo",
                          "description": "For dry hair",
                          "variants": [
                            { "label": "250 ml", "sku": "SHMP-250", "price": 18.00, "currency": "USD", "quantityOnHand": 10, "reorderLevel": 3 },
                            { "label": "500 ml", "sku": "SHMP-500", "price": 30.00, "currency": "USD", "quantityOnHand": 5,  "reorderLevel": 2 }
                          ]
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.name").isEqualTo("Nourishing Shampoo")
                .jsonPath("$.variants.length()").isEqualTo(2)
                .jsonPath("$.variants[0].quantityOnHand").isEqualTo(10)
                .returnResult();

        var productId = jsonLong(created.getResponseBody(), "$.id");

        // Inventory endpoint surfaces both variants
        client.get().uri(adminBase() + "/inventory").exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.length()").isEqualTo(2);

        // customer catalogue sees the product
        client.get().uri(customerBase() + "/products").exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.length()").isEqualTo(1)
                .jsonPath("$[0].variants.length()").isEqualTo(2);

        // adjust stock on the first variant
        var inv = client.get().uri(adminBase() + "/inventory").exchange()
                .expectStatus().isOk().expectBody().returnResult();
        var variantId = jsonLong(inv.getResponseBody(), "$[0].variantId");

        client.put().uri(adminBase() + "/inventory/" + variantId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"quantityOnHand\": 0, \"reorderLevel\": 3 }")
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.quantityOnHand").isEqualTo(0);

        // delete the product
        client.delete().uri(adminBase() + "/products/" + productId).exchange().expectStatus().isNoContent();
        client.get().uri(customerBase() + "/products").exchange()
                .expectStatus().isOk().expectBody().jsonPath("$.length()").isEqualTo(0);
    }

    // ── Checkout + order lifecycle + activity timeline ─────────────────────

    @Test
    void checkoutDecrementsStockAndBuildsTimeline() {
        var created = client.post().uri(adminBase() + "/products")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                          "name": "Styling Clay",
                          "variants": [ { "label": "100 ml", "price": 22.50, "currency": "USD", "quantityOnHand": 2, "reorderLevel": 1 } ]
                        }
                        """)
                .exchange().expectStatus().isCreated()
                .expectBody().returnResult();
        var variantId = jsonLong(created.getResponseBody(), "$.variants[0].id");

        var order = client.post().uri(customerBase() + "/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                          "customerName": "Alex Doe",
                          "customerEmail": "alex@example.com",
                          "customerPhone": "+123456",
                          "shippingAddress": { "line1": "1 Main St", "city": "Townsville", "country": "US", "zipCode": "12345" },
                          "items": [ { "variantId": %d, "quantity": 2 } ]
                        }
                        """.formatted(variantId))
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.orderNumber").isNotEmpty()
                .jsonPath("$.status").isEqualTo("PAID")
                .jsonPath("$.paymentStatus").isEqualTo("PAID")
                .jsonPath("$.subtotal").isEqualTo(45.00)
                .jsonPath("$.lines.length()").isEqualTo(1)
                .jsonPath("$.lines[0].activities.length()").isEqualTo(1)
                .jsonPath("$.lines[0].activities[0].type").isEqualTo("LINE_CREATED")
                .returnResult();

        var orderId = jsonLong(order.getResponseBody(), "$.id");
        var lineId = jsonLong(order.getResponseBody(), "$.lines[0].id");

        // stock is now exhausted → a second order 409s
        client.post().uri(customerBase() + "/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                          "customerName": "Sam Roe", "customerEmail": "sam@example.com",
                          "items": [ { "variantId": %d, "quantity": 1 } ]
                        }
                        """.formatted(variantId))
                .exchange()
                .expectStatus().isEqualTo(409);

        // admin sees the order
        client.get().uri(adminBase() + "/orders").exchange()
                .expectStatus().isOk().expectBody().jsonPath("$.length()").isEqualTo(1);

        // "Notify User" appends a USER_NOTIFIED activity
        client.post().uri(adminBase() + "/orders/" + orderId + "/lines/" + lineId + "/notify")
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.lines[0].activities.length()").isEqualTo(2)
                .jsonPath("$.lines[0].activities[1].type").isEqualTo("USER_NOTIFIED");

        // "Add a Note"
        client.post().uri(adminBase() + "/orders/" + orderId + "/lines/" + lineId + "/notes")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"note\": \"Packed and ready\" }")
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.lines[0].activities.length()").isEqualTo(3)
                .jsonPath("$.lines[0].activities[2].type").isEqualTo("NOTE_ADDED")
                .jsonPath("$.lines[0].activities[2].message").isEqualTo("Packed and ready");

        // status transition → STATUS_CHANGED activity on the line
        client.post().uri(adminBase() + "/orders/" + orderId + "/status")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"status\": \"FULFILLED\" }")
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.status").isEqualTo("FULFILLED")
                .jsonPath("$.lines[0].activities.length()").isEqualTo(4)
                .jsonPath("$.lines[0].activities[3].type").isEqualTo("STATUS_CHANGED");
    }

    @Test
    void checkoutRejectsEmptyCart() {
        client.post().uri(customerBase() + "/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"customerName\": \"A\", \"customerEmail\": \"a@b.c\", \"items\": [] }")
                .exchange()
                .expectStatus().isBadRequest();
    }

    @Test
    void crossSalonIsolation() {
        var otherSalon = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO salon (id, name, handler, owner_email, created_at) VALUES (?, ?, ?, ?, now())",
                otherSalon, "Other", "other-" + otherSalon.toString().substring(0, 8), "x@y.z");

        var created = client.post().uri("/api/salon-admin/" + salonId + "/shop/products")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "name": "Private", "variants": [ { "label": "x", "price": 1.00, "quantityOnHand": 1 } ] }
                        """)
                .exchange().expectStatus().isCreated().expectBody().returnResult();
        var productId = jsonLong(created.getResponseBody(), "$.id");

        client.get().uri("/api/salon-admin/" + otherSalon + "/shop/products/" + productId)
                .exchange()
                .expectStatus().isNotFound();
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private static long jsonLong(byte[] body, String jsonPath) {
        var json = new String(body != null ? body : new byte[0], java.nio.charset.StandardCharsets.UTF_8);
        Object value = com.jayway.jsonpath.JsonPath.parse(json).read(jsonPath);
        return ((Number) value).longValue();
    }
}
