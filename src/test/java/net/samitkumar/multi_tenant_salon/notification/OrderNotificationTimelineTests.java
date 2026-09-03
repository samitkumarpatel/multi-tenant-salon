package net.samitkumar.multi_tenant_salon.notification;

import com.jayway.jsonpath.JsonPath;
import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * End-to-end coverage for the notification round-trip: a customer email dispatched by the
 * notification module is acknowledged via {@code shop.OrderCustomerNotifiedEvent} and lands on the
 * order's activity timeline as a {@code CUSTOMER_NOTIFIED} entry carrying the exact subject/body.
 *
 * <p>Full {@code @SpringBootTest} context — the round-trip spans the {@code shop} and
 * {@code notification} modules plus their listeners. Mailjet is unconfigured in tests, so the
 * recorded status is {@code LOGGED}, not {@code SENT}.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class OrderNotificationTimelineTests {

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
                salonId, "Notif Timeline Salon", "notif-tl-" + salonId.toString().substring(0, 8),
                "Owner", "owner@notif.test", "salon@notif.test", "+100000000");
    }

    private String adminBase() { return "/api/salon-admin/" + salonId + "/shop"; }
    private String customerBase() { return "/api/salon/" + salonId + "/shop"; }

    @Test
    void customerOrderEmailsAreRecordedOnTheOrderTimeline() {
        var product = client.post().uri(adminBase() + "/products")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                          "name": "Repair Serum",
                          "variants": [ { "label": "30 ml", "price": 25.00, "currency": "USD", "quantityOnHand": 5 } ]
                        }
                        """)
                .exchange().expectStatus().isCreated()
                .expectBody().returnResult();
        long variantId = jsonLong(product.getResponseBody(), "$.variants[0].id");

        var order = client.post().uri(customerBase() + "/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {
                          "customerName": "Alex Doe",
                          "customerEmail": "alex@example.com",
                          "items": [ { "variantId": %d, "quantity": 1 } ]
                        }
                        """.formatted(variantId))
                .exchange().expectStatus().isCreated()
                .expectBody().returnResult();
        long orderId = jsonLong(order.getResponseBody(), "$.id");

        // The place-order email is dispatched + acknowledged asynchronously.
        var placed = awaitActivity(orderId, "Order received");
        assertThat(placed.get("status")).isEqualTo("LOGGED");
        assertThat(placed.get("channel")).isEqualTo("EMAIL");
        assertThat((String) placed.get("subject")).contains("Order received");
        assertThat((String) placed.get("body")).contains("Alex Doe").contains("We've received order");
        assertThat(placed.get("notified")).isEqualTo(Boolean.TRUE);

        // A status change sends (and records) a second customer email.
        client.post().uri(adminBase() + "/orders/" + orderId + "/status")
                .contentType(MediaType.APPLICATION_JSON)
                .body("{ \"status\": \"PROCESSING\" }")
                .exchange().expectStatus().isOk();

        var updated = awaitActivity(orderId, "Order update");
        assertThat((String) updated.get("body")).contains("being prepared");
    }

    /** Polls the order-detail endpoint until a CUSTOMER_NOTIFIED activity whose subject contains
     *  {@code subjectFragment} appears, then returns it. */
    private Map<String, Object> awaitActivity(long orderId, String subjectFragment) {
        return await().atMost(Duration.ofSeconds(15)).pollInterval(Duration.ofMillis(250))
                .until(() -> findNotifiedActivity(orderId, subjectFragment), a -> a != null);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> findNotifiedActivity(long orderId, String subjectFragment) {
        var res = client.get().uri(adminBase() + "/orders/" + orderId)
                .exchange().expectStatus().isOk()
                .expectBody().returnResult();
        var json = new String(res.getResponseBody() != null ? res.getResponseBody() : new byte[0], StandardCharsets.UTF_8);
        List<Map<String, Object>> activities = JsonPath.parse(json).read("$.activities");
        return activities.stream()
                .filter(a -> "CUSTOMER_NOTIFIED".equals(a.get("type")))
                .filter(a -> a.get("subject") != null && ((String) a.get("subject")).contains(subjectFragment))
                .findFirst()
                .orElse(null);
    }

    private static long jsonLong(byte[] body, String path) {
        var json = new String(body != null ? body : new byte[0], StandardCharsets.UTF_8);
        return ((Number) JsonPath.parse(json).read(path)).longValue();
    }
}
