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

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

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
                .jsonPath("$.status").isEqualTo("NEW")
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

        // admin sees the order — the list is now a paged envelope
        client.get().uri(adminBase() + "/orders").exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.content.length()").isEqualTo(1)
                .jsonPath("$.totalElements").isEqualTo(1)
                .jsonPath("$.page").isEqualTo(0)
                .jsonPath("$.totalPages").isEqualTo(1)
                .jsonPath("$.statusCounts.NEW").isEqualTo(1);

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
    void ordersListIsSearchableSortableAndPaged() {
        var created = client.post().uri(adminBase() + "/products")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                          "name": "Argan Oil Serum",
                          "variants": [ { "label": "50 ml", "price": 10.00, "currency": "USD", "quantityOnHand": 50 } ]
                        }
                        """)
                .exchange().expectStatus().isCreated().expectBody().returnResult();
        var variantId = jsonLong(created.getResponseBody(), "$.variants[0].id");

        // Three orders, placed oldest → newest: Alice, Bob, Carol.
        placeOrder(variantId, "Alice Adams", "alice@example.com", 1);
        placeOrder(variantId, "Bob Brown", "bob@contractor.org", 2);
        placeOrder(variantId, "Carol Clark", "carol@example.com", 1);

        // Default page: newest first, everything on one page.
        client.get().uri(adminBase() + "/orders").exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.content.length()").isEqualTo(3)
                .jsonPath("$.totalElements").isEqualTo(3)
                .jsonPath("$.totalPages").isEqualTo(1)
                .jsonPath("$.content[0].customerName").isEqualTo("Carol Clark")
                .jsonPath("$.statusCounts.NEW").isEqualTo(3)
                .jsonPath("$.statusCounts.SHIPPED").isEqualTo(0);

        // Pagination.
        client.get().uri(adminBase() + "/orders?size=2").exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.content.length()").isEqualTo(2)
                .jsonPath("$.totalElements").isEqualTo(3)
                .jsonPath("$.totalPages").isEqualTo(2);
        client.get().uri(adminBase() + "/orders?size=2&page=1").exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.content.length()").isEqualTo(1)
                .jsonPath("$.content[0].customerName").isEqualTo("Alice Adams");

        // Sort oldest-first.
        client.get().uri(adminBase() + "/orders?sort=oldest").exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.content[0].customerName").isEqualTo("Alice Adams");

        // Search: by email, by name fragment, and by line product name.
        client.get().uri(adminBase() + "/orders?q=bob@contractor.org").exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.content.length()").isEqualTo(1)
                .jsonPath("$.content[0].customerName").isEqualTo("Bob Brown");
        client.get().uri(adminBase() + "/orders?q=clark").exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.content.length()").isEqualTo(1)
                .jsonPath("$.content[0].customerName").isEqualTo("Carol Clark");
        client.get().uri(adminBase() + "/orders?q=argan").exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.content.length()").isEqualTo(3);

        // Status filter — facet counts stay scoped to the search, not the status.
        client.get().uri(adminBase() + "/orders?status=SHIPPED").exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.content.length()").isEqualTo(0)
                .jsonPath("$.totalElements").isEqualTo(0)
                .jsonPath("$.statusCounts.NEW").isEqualTo(3);

        // Date range on the order date. The API reads from/to as UTC days, so "today" must be the UTC
        // date too — the JVM's local date is a day ahead between midnight and the UTC offset.
        var today = LocalDate.now(ZoneOffset.UTC);
        client.get().uri(adminBase() + "/orders?from=" + today + "&to=" + today).exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.content.length()").isEqualTo(3);
        client.get().uri(adminBase() + "/orders?from=" + today.plusDays(1)).exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.content.length()").isEqualTo(0);
    }

    private void placeOrder(long variantId, String name, String email, int qty) {
        client.post().uri(customerBase() + "/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "customerName": "%s", "customerEmail": "%s",
                          "items": [ { "variantId": %d, "quantity": %d } ] }
                        """.formatted(name, email, variantId, qty))
                .exchange().expectStatus().isCreated();
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
    void checkoutRejectsMalformedEmail() {
        client.post().uri(customerBase() + "/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"customerName\": \"A\", \"customerEmail\": \"not-an-email\", \"items\": [ { \"variantId\": 1, \"quantity\": 1 } ] }")
                .exchange()
                .expectStatus().isBadRequest();
    }

    @Test
    void checkoutOptionsReportNoOnlinePaymentWithoutStripe() {
        client.get().uri(customerBase() + "/checkout-options")
                .exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.onlinePayment").isEqualTo(false);
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
                        { "name": "Private", "variants": [ { "label": "x", "price": 1.00, "quantityOnHand": 1, "weightGrams": 100 } ] }
                        """)
                .exchange().expectStatus().isCreated().expectBody().returnResult();
        var productId = jsonLong(created.getResponseBody(), "$.id");

        client.get().uri("/api/salon-admin/" + otherSalon + "/shop/products/" + productId)
                .exchange()
                .expectStatus().isNotFound();
    }

    // ── Product image gallery ─────────────────────────────────────────────

    @Test
    void productGallerySupportsMultipleImagesAndReorder() {
        var created = client.post().uri(adminBase() + "/products")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                          "name": "Gift Set",
                          "images": ["https://cdn.test/a.jpg", "https://cdn.test/b.jpg", "https://cdn.test/c.jpg"],
                          "variants": [ { "label": "one", "price": 40.00, "currency": "USD", "quantityOnHand": 5, "weightGrams": 200 } ]
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.images.length()").isEqualTo(3)
                .jsonPath("$.images[0]").isEqualTo("https://cdn.test/a.jpg")
                .jsonPath("$.imageUrl").isEqualTo("https://cdn.test/a.jpg") // cover mirrors images[0]
                .returnResult();

        var productId = jsonLong(created.getResponseBody(), "$.id");
        var variantId = jsonLong(created.getResponseBody(), "$.variants[0].id");

        // Reorder (c first) and drop b
        client.put().uri(adminBase() + "/products/" + productId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                          "name": "Gift Set",
                          "images": ["https://cdn.test/c.jpg", "https://cdn.test/a.jpg"],
                          "variants": [ { "id": %d, "label": "one", "price": 40.00, "currency": "USD", "quantityOnHand": 5, "weightGrams": 200 } ]
                        }
                        """.formatted(variantId))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.images.length()").isEqualTo(2)
                .jsonPath("$.images[0]").isEqualTo("https://cdn.test/c.jpg")
                .jsonPath("$.imageUrl").isEqualTo("https://cdn.test/c.jpg");

        // Public detail view carries the ordered gallery too
        client.get().uri(customerBase() + "/products/" + productId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.images.length()").isEqualTo(2)
                .jsonPath("$.images[1]").isEqualTo("https://cdn.test/a.jpg");
    }

    @Test
    void legacyImageUrlStillPopulatesGallery() {
        client.post().uri(adminBase() + "/products")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                          "name": "Legacy",
                          "imageUrl": "https://cdn.test/legacy.jpg",
                          "variants": [ { "label": "x", "price": 1.00, "quantityOnHand": 1, "weightGrams": 100 } ]
                        }
                        """)
                .exchange()
                .expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.imageUrl").isEqualTo("https://cdn.test/legacy.jpg")
                .jsonPath("$.images.length()").isEqualTo(1)
                .jsonPath("$.images[0]").isEqualTo("https://cdn.test/legacy.jpg");
    }

    // ── Stock restoration & order status transitions ────────────────────────

    /** A product with one variant holding {@code stock} units; returns the variant id. */
    private long variantWithStock(String name, int stock) {
        var created = client.post().uri(adminBase() + "/products")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                          "name": "%s",
                          "variants": [ { "label": "100 ml", "price": 10.00, "currency": "USD", "quantityOnHand": %d } ]
                        }
                        """.formatted(name, stock))
                .exchange().expectStatus().isCreated().expectBody().returnResult();
        return jsonLong(created.getResponseBody(), "$.variants[0].id");
    }

    private int stockOf(long variantId) {
        return jdbcTemplate.queryForObject(
                "SELECT quantity_on_hand FROM product_variant WHERE id = ?", Integer.class, variantId);
    }

    private long placeOrderReturningId(long variantId, int qty) {
        var order = client.post().uri(customerBase() + "/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "customerName": "Alex Doe", "customerEmail": "alex@example.com",
                          "items": [ { "variantId": %d, "quantity": %d } ] }
                        """.formatted(variantId, qty))
                .exchange().expectStatus().isCreated().expectBody().returnResult();
        return jsonLong(order.getResponseBody(), "$.id");
    }

    private void setStatus(long orderId, String status, int expectedCode) {
        client.post().uri(adminBase() + "/orders/" + orderId + "/status")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"status\": \"%s\" }".formatted(status))
                .exchange().expectStatus().isEqualTo(expectedCode);
    }

    @Test
    void cancellingAnOrderPutsTheStockBack() {
        var variantId = variantWithStock("Restock Clay", 2);
        var orderId = placeOrderReturningId(variantId, 2);
        assertThat(stockOf(variantId)).isZero();

        setStatus(orderId, "CANCELLED", 200);

        assertThat(stockOf(variantId)).isEqualTo(2);
        // and the freed stock is genuinely sellable again
        client.post().uri(customerBase() + "/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "customerName": "Sam Roe", "customerEmail": "sam@example.com",
                          "items": [ { "variantId": %d, "quantity": 2 } ] }
                        """.formatted(variantId))
                .exchange().expectStatus().isCreated();
    }

    @Test
    void stockIsOnlyEverCreditedOnce() {
        var variantId = variantWithStock("Once Only Clay", 5);
        var orderId = placeOrderReturningId(variantId, 3);
        assertThat(stockOf(variantId)).isEqualTo(2);

        // Stand in for an earlier restock (a failed payment takes this same path): once the order
        // is marked restored, cancelling must not credit the quantity a second time.
        jdbcTemplate.update("UPDATE shop_order SET stock_restored_at = now() WHERE id = ?", orderId);

        setStatus(orderId, "CANCELLED", 200);

        assertThat(stockOf(variantId)).isEqualTo(2);
    }

    @Test
    void aReceivedReturnPutsTheStockBack() {
        var variantId = variantWithStock("Returnable Clay", 4);
        var orderId = placeOrderReturningId(variantId, 1);
        assertThat(stockOf(variantId)).isEqualTo(3);

        client.post().uri(adminBase() + "/orders/" + orderId + "/returns")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"reason\": \"Wrong shade\" }")
                .exchange().expectStatus().isOk();
        assertThat(stockOf(variantId)).isEqualTo(3); // merely requesting changes nothing

        client.post().uri(adminBase() + "/orders/" + orderId + "/returns/status")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"status\": \"RECEIVED\" }")
                .exchange().expectStatus().isOk();

        assertThat(stockOf(variantId)).isEqualTo(4);
    }

    @Test
    void aSettledOrderCanNoLongerChangeStatus() {
        var variantId = variantWithStock("Terminal Clay", 3);
        var cancelled = placeOrderReturningId(variantId, 1);
        setStatus(cancelled, "CANCELLED", 200);
        setStatus(cancelled, "NEW", 409);          // un-cancelling is refused
        setStatus(cancelled, "PROCESSING", 409);

        var fulfilled = placeOrderReturningId(variantId, 1);
        setStatus(fulfilled, "FULFILLED", 200);
        setStatus(fulfilled, "PROCESSING", 409);

        client.get().uri(adminBase() + "/orders/" + cancelled).exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.status").isEqualTo("CANCELLED");
    }

    @Test
    void addingShippingShipsTheOrderButNeverRevivesACancelledOne() {
        var variantId = variantWithStock("Shipping Clay", 5);

        var open = placeOrderReturningId(variantId, 1);
        client.post().uri(adminBase() + "/orders/" + open + "/shipping")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"carrier\": \"DHL\", \"trackingNumber\": \"TRACK-1\" }")
                .exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.status").isEqualTo("SHIPPED");

        // a shipped order can no longer be cancelled — a return is the way back
        setStatus(open, "CANCELLED", 409);

        var cancelled = placeOrderReturningId(variantId, 1);
        setStatus(cancelled, "CANCELLED", 200);
        client.post().uri(adminBase() + "/orders/" + cancelled + "/shipping")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"carrier\": \"DHL\", \"trackingNumber\": \"TRACK-2\" }")
                .exchange().expectStatus().isEqualTo(409);

        client.get().uri(adminBase() + "/orders/" + cancelled).exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.status").isEqualTo("CANCELLED");
    }

    // ── Shipping methods ────────────────────────────────────────────────────

    private long shippingMethod(String json) {
        var res = client.post().uri(adminBase() + "/shipping-methods")
                .contentType(MediaType.APPLICATION_JSON).body(json)
                .exchange().expectStatus().isCreated().expectBody().returnResult();
        return jsonLong(res.getResponseBody(), "$.id");
    }

    @Test
    void shippingOptionsFollowTheOwnersRules() {
        var variantId = variantWithStock("Shipping Shampoo", 20);
        // Denmark only, free from 50; a heavy-cart courier for 3+ items anywhere; an inactive one.
        var postnord = shippingMethod("""
                { "name": "PostNord parcel shop", "carrier": "PostNord", "deliveryType": "PICKUP_POINT",
                  "price": 5.00, "freeOver": 50.00, "countries": ["dk"], "minDeliveryDays": 1, "maxDeliveryDays": 3 }
                """);
        shippingMethod("""
                { "name": "GLS courier", "price": 12.00, "minItems": 3 }
                """);
        shippingMethod("""
                { "name": "Retired", "price": 1.00, "active": false }
                """);

        client.get().uri(adminBase() + "/shipping-methods").exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.length()").isEqualTo(3)
                .jsonPath("$[?(@.name == 'PostNord parcel shop')].countries[0]").isEqualTo("DK");

        // 1 item to Denmark (by name, as the storefront sends it): only PostNord, at full price.
        client.post().uri(customerBase() + "/shipping-options")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"country\": \"Denmark\", \"items\": [ { \"variantId\": %d, \"quantity\": 1 } ] }".formatted(variantId))
                .exchange().expectStatus().isOk()
                .expectBody()
                .jsonPath("$.configured").isEqualTo(true)
                .jsonPath("$.options.length()").isEqualTo(1)
                .jsonPath("$.options[0].id").isEqualTo(postnord)
                .jsonPath("$.options[0].cost").isEqualTo(5.0);

        // 5 items (50.00) to Denmark: PostNord is now free and the courier qualifies too.
        client.post().uri(customerBase() + "/shipping-options")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"country\": \"DK\", \"items\": [ { \"variantId\": %d, \"quantity\": 5 } ] }".formatted(variantId))
                .exchange().expectStatus().isOk()
                .expectBody()
                .jsonPath("$.options.length()").isEqualTo(2)
                .jsonPath("$.options[0].free").isEqualTo(true)
                .jsonPath("$.options[1].name").isEqualTo("GLS courier");

        // 1 item to Sweden: nothing ships there.
        client.post().uri(customerBase() + "/shipping-options")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"country\": \"Sweden\", \"items\": [ { \"variantId\": %d, \"quantity\": 1 } ] }".formatted(variantId))
                .exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.options.length()").isEqualTo(0);
    }

    @Test
    void checkoutChargesTheChosenShippingMethod() {
        var variantId = variantWithStock("Shipped Conditioner", 10);
        var method = shippingMethod("""
                { "name": "Home delivery", "price": 7.50, "countries": ["DK"] }
                """);
        var address = "\"shippingAddress\": { \"line1\": \"Main St 1\", \"city\": \"Copenhagen\", \"country\": \"Denmark\" }";

        client.post().uri(customerBase() + "/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "customerName": "Alex Doe", "customerEmail": "alex@example.com", %s, "shippingMethodId": %d,
                          "items": [ { "variantId": %d, "quantity": 2 } ] }
                        """.formatted(address, method, variantId))
                .exchange().expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.subtotal").isEqualTo(20.0)
                .jsonPath("$.shippingMethodName").isEqualTo("Home delivery")
                .jsonPath("$.shippingCost").isEqualTo(7.5)
                .jsonPath("$.total").isEqualTo(27.5);

        // Collecting in salon never pays shipping, even with methods configured.
        client.post().uri(customerBase() + "/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "customerName": "Alex Doe", "customerEmail": "alex@example.com",
                          "items": [ { "variantId": %d, "quantity": 1 } ] }
                        """.formatted(variantId))
                .exchange().expectStatus().isCreated()
                .expectBody().jsonPath("$.shippingCost").isEqualTo(0).jsonPath("$.total").isEqualTo(10.0);

        // A destination no method covers is refused — and leaves the stock alone.
        int before = stockOf(variantId);
        client.post().uri(customerBase() + "/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "customerName": "Alex Doe", "customerEmail": "alex@example.com",
                          "shippingAddress": { "line1": "Gatan 1", "city": "Malmö", "country": "Sweden" },
                          "items": [ { "variantId": %d, "quantity": 1 } ] }
                        """.formatted(variantId))
                .exchange().expectStatus().isBadRequest();
        assertThat(stockOf(variantId)).isEqualTo(before);
    }

    @Test
    void shippingIsFreeWhenTheSalonHasNoMethods() {
        var variantId = variantWithStock("Legacy Gel", 5);
        client.post().uri(customerBase() + "/shipping-options")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"country\": \"Denmark\", \"items\": [ { \"variantId\": %d, \"quantity\": 1 } ] }".formatted(variantId))
                .exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.configured").isEqualTo(false);
        client.post().uri(customerBase() + "/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "customerName": "Alex Doe", "customerEmail": "alex@example.com",
                          "shippingAddress": { "line1": "Main St 1", "city": "Copenhagen", "country": "Denmark" },
                          "items": [ { "variantId": %d, "quantity": 1 } ] }
                        """.formatted(variantId))
                .exchange().expectStatus().isCreated()
                .expectBody().jsonPath("$.shippingCost").isEqualTo(0).jsonPath("$.total").isEqualTo(10.0);
    }

    @Test
    void shippingMethodValidationAndDelete() {
        client.post().uri(adminBase() + "/shipping-methods")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"name\": \"Bad\", \"minItems\": 5, \"maxItems\": 2 }")
                .exchange().expectStatus().isBadRequest();
        client.post().uri(adminBase() + "/shipping-methods")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"name\": \"Bad\", \"countries\": [\"Denmark\"] }")
                .exchange().expectStatus().isBadRequest();
        var id = shippingMethod("{ \"name\": \"Standard\", \"price\": 4 }");
        client.put().uri(adminBase() + "/shipping-methods/" + id)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"name\": \"Standard+\", \"price\": 6, \"countries\": [\"SE\", \"NO\"] }")
                .exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.name").isEqualTo("Standard+").jsonPath("$.countries.length()").isEqualTo(2);
        client.delete().uri(adminBase() + "/shipping-methods/" + id).exchange().expectStatus().isNoContent();
        client.get().uri(adminBase() + "/shipping-methods").exchange()
                .expectStatus().isOk().expectBody().jsonPath("$.length()").isEqualTo(0);
    }

    // ── Weight & currency ───────────────────────────────────────────────────

    @Test
    void variantWeightIsEstimatedFromItsUnitOrRequired() {
        // 250 ml → 250 g contents + 10 % packaging = 275 → rounded up to 280 g; an explicit weight wins.
        client.post().uri(adminBase() + "/products")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "name": "Weighed", "variants": [
                            { "label": "250 ml", "price": 5 },
                            { "label": "1.5 kg", "price": 9, "weightGrams": 1600 } ] }
                        """)
                .exchange().expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.variants[0].weightGrams").isEqualTo(280)
                .jsonPath("$.variants[1].weightGrams").isEqualTo(1600);

        // No measurable unit and no weight: refused, nothing created.
        client.post().uri(adminBase() + "/products")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"name\": \"Gift set\", \"variants\": [ { \"label\": \"1 set\", \"price\": 20 } ] }")
                .exchange().expectStatus().isBadRequest();
        client.get().uri(adminBase() + "/products").exchange()
                .expectStatus().isOk().expectBody().jsonPath("$.length()").isEqualTo(1);
    }

    @Test
    void shippingWeightBracketsPickTheMethod() {
        var variantId = variantWithStock("Heavy Mask", 50); // 100 ml → 110 g each
        var light = shippingMethod("{ \"name\": \"Letter\", \"price\": 3, \"maxWeightGrams\": 500 }");
        var heavy = shippingMethod("{ \"name\": \"Parcel\", \"price\": 9, \"minWeightGrams\": 501, \"maxWeightGrams\": 20000 }");

        client.post().uri(customerBase() + "/shipping-options")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"country\": \"DK\", \"items\": [ { \"variantId\": %d, \"quantity\": 4 } ] }".formatted(variantId))
                .exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.options.length()").isEqualTo(1).jsonPath("$.options[0].id").isEqualTo(light);

        // 5 × 110 g = 550 g: only the parcel; the order records its weight.
        client.post().uri(customerBase() + "/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "customerName": "Alex Doe", "customerEmail": "alex@example.com", "shippingMethodId": %d,
                          "shippingAddress": { "line1": "Main St 1", "city": "Copenhagen", "country": "Denmark" },
                          "items": [ { "variantId": %d, "quantity": 5 } ] }
                        """.formatted(heavy, variantId))
                .exchange().expectStatus().isCreated()
                .expectBody()
                .jsonPath("$.shippingMethodName").isEqualTo("Parcel")
                .jsonPath("$.totalWeightGrams").isEqualTo(550);
    }

    @Test
    void productsDefaultToTheSalonCurrencyAndCanBeAligned() {
        jdbcTemplate.update("UPDATE salon SET country = 'Denmark' WHERE id = ?", salonId);

        // No currency given → the salon's (DKK); an explicit one is kept on purpose.
        client.post().uri(adminBase() + "/products")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"name\": \"Local\", \"variants\": [ { \"label\": \"50 ml\", \"price\": 99, \"quantityOnHand\": 1 } ] }")
                .exchange().expectStatus().isCreated()
                .expectBody().jsonPath("$.variants[0].currency").isEqualTo("DKK");
        var euro = client.post().uri(adminBase() + "/products")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"name\": \"Imported\", \"variants\": [ { \"label\": \"50 ml\", \"price\": 12, \"currency\": \"EUR\", \"quantityOnHand\": 1 } ] }")
                .exchange().expectStatus().isCreated()
                .expectBody().jsonPath("$.variants[0].currency").isEqualTo("EUR").returnResult();
        var euroVariant = jsonLong(euro.getResponseBody(), "$.variants[0].id");

        // One product, one currency.
        client.post().uri(adminBase() + "/products")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "name": "Mixed", "variants": [
                            { "label": "50 ml", "price": 1, "currency": "DKK" },
                            { "label": "100 ml", "price": 2, "currency": "EUR" } ] }
                        """)
                .exchange().expectStatus().isBadRequest();

        // A DKK and a EUR item can't share one order.
        var dkkVariant = jdbcTemplate.queryForObject(
                "SELECT id FROM product_variant WHERE salon_id = ? AND currency = 'DKK'", Long.class, salonId);
        client.post().uri(customerBase() + "/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "customerName": "Alex Doe", "customerEmail": "alex@example.com",
                          "items": [ { "variantId": %d, "quantity": 1 }, { "variantId": %d, "quantity": 1 } ] }
                        """.formatted(dkkVariant, euroVariant))
                .exchange().expectStatus().isBadRequest();
        assertThat(stockOf(dkkVariant)).isEqualTo(1);

        // Aligning re-labels the EUR product with the salon currency, amounts unchanged.
        client.post().uri(adminBase() + "/products/align-currency").exchange()
                .expectStatus().isOk()
                .expectBody().jsonPath("$.currency").isEqualTo("DKK").jsonPath("$.updated").isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("SELECT currency FROM product_variant WHERE id = ?", String.class, euroVariant))
                .isEqualTo("DKK");

        // Shipping methods default to the salon currency too, and only match carts in it.
        shippingMethod("{ \"name\": \"Euro only\", \"price\": 4, \"currency\": \"EUR\" }");
        client.get().uri(adminBase() + "/shipping-methods").exchange()
                .expectStatus().isOk().expectBody().jsonPath("$[0].currency").isEqualTo("EUR");
        client.post().uri(customerBase() + "/shipping-options")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"country\": \"DK\", \"items\": [ { \"variantId\": %d, \"quantity\": 1 } ] }".formatted(dkkVariant))
                .exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.configured").isEqualTo(true).jsonPath("$.options.length()").isEqualTo(0);
    }

    // ── helpers ────────────────────────────────────────────────────────────

    private static long jsonLong(byte[] body, String jsonPath) {
        var json = new String(body != null ? body : new byte[0], java.nio.charset.StandardCharsets.UTF_8);
        Object value = com.jayway.jsonpath.JsonPath.parse(json).read(jsonPath);
        return ((Number) value).longValue();
    }
}
