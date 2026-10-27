package net.samitkumar.multi_tenant_salon.customer;

import com.jayway.jsonpath.JsonPath;
import net.samitkumar.multi_tenant_salon.MultiTenantSalonApplication;
import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import net.samitkumar.multi_tenant_salon.booking.BookingCreatedEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/** The owner's customer list: events fill it, the owner searches, edits and erases, and erasing reaches the history. */
@SpringBootTest(classes = MultiTenantSalonApplication.class)
@Import(TestcontainersConfiguration.class)
class CustomerDirectoryIntegrationTest {

    @Autowired JdbcTemplate jdbc;
    @Autowired net.samitkumar.multi_tenant_salon.rating.RatingApi ratings;
    @Autowired ApplicationEventPublisher publisher;
    @Autowired PlatformTransactionManager transactionManager;

    RestTestClient client;
    UUID salonId;
    UUID otherSalonId;
    long serviceId;
    long staffId;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
        salonId = salon("Directory Salon");
        otherSalonId = salon("Other Directory Salon");
        serviceId = jdbc.queryForObject("INSERT INTO service_item (salon_id, name, category, price, currency, duration_minutes, active, created_at) " +
                "VALUES (?, 'Haircut', 'HAIR', 40, 'EUR', 60, true, now()) RETURNING id", Long.class, salonId);
        staffId = jdbc.queryForObject("INSERT INTO staff_member (salon_id, name, role, status, created_at) " +
                "VALUES (?, 'Sam Stylist', 'STYLIST', 'ACTIVE', now()) RETURNING id", Long.class, salonId);
    }

    @Test
    void createSearchEditAndRejectDuplicates() {
        var ann = create(salonId, "Ann Lee", "Ann@Example.com", "+4511111111", "Prefers mornings");
        create(salonId, "Bob Ray", "bob@example.com", null, null);
        create(otherSalonId, "Ann Lee", "ann@example.com", null, null); // same email, other salon: unrelated

        // Same email in the same salon, whatever the case.
        post(salonId, "{\"name\":\"Ann Again\",\"email\":\"ANN@example.com\"}").expectStatus().isEqualTo(409);
        post(salonId, "{\"name\":\"\",\"email\":\"x@example.com\"}").expectStatus().isBadRequest();
        post(salonId, "{\"name\":\"No Email\",\"email\":\"nope\"}").expectStatus().isBadRequest();

        var all = list(salonId, null, null);
        assertThat(JsonPath.<Integer>read(all, "$.totalElements")).isEqualTo(2);
        assertThat(JsonPath.<List<String>>read(list(salonId, "ann", null), "$.content[*].email")).containsExactly("Ann@Example.com");
        assertThat(JsonPath.<List<String>>read(list(salonId, "+4511", null), "$.content[*].name")).containsExactly("Ann Lee");
        assertThat(JsonPath.<Integer>read(list(salonId, "%", null), "$.totalElements")).as("% is not a wildcard").isZero();
        assertThat(JsonPath.<List<String>>read(list(salonId, null, "name"), "$.content[*].name")).containsExactly("Ann Lee", "Bob Ray");

        client.put().uri("/api/salon-admin/{id}/customers/{c}", salonId, ann)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"name\":\"Ann Smith\",\"email\":\"ignored@example.com\",\"phone\":\"\",\"notes\":\"VIP\"}")
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.name").isEqualTo("Ann Smith")
                .jsonPath("$.email").isEqualTo("Ann@Example.com")
                .jsonPath("$.phone").isEmpty()
                .jsonPath("$.notes").isEqualTo("VIP");
        // Another salon's owner can't reach it.
        client.get().uri("/api/salon-admin/{id}/customers/{c}", otherSalonId, ann).exchange().expectStatus().isNotFound();
        client.put().uri("/api/salon-admin/{id}/customers/{c}", otherSalonId, ann).contentType(MediaType.APPLICATION_JSON)
                .body("{\"name\":\"Hijack\"}").exchange().expectStatus().isNotFound();
        client.delete().uri("/api/salon-admin/{id}/customers/{c}", otherSalonId, ann).exchange().expectStatus().isNotFound();
    }

    @Test
    void aBookingOrOrderAddsTheCustomerWithoutOverwritingOwnerEdits() {
        publish(bookingCreated("Cara Diaz", "cara@example.com", null));
        await().atMost(Duration.ofSeconds(15)).untilAsserted(() ->
                assertThat(JsonPath.<List<String>>read(list(salonId, "cara", null), "$.content[*].name")).containsExactly("Cara Diaz"));

        var id = JsonPath.<Integer>read(list(salonId, "cara", null), "$.content[0].id").longValue();
        client.put().uri("/api/salon-admin/{id}/customers/{c}", salonId, id).contentType(MediaType.APPLICATION_JSON)
                .body("{\"name\":\"Cara D.\",\"notes\":\"Allergic to ammonia\"}").exchange().expectStatus().isOk();

        // A second booking (new casing, and a phone the record lacked) changes neither name nor notes.
        publish(bookingCreated("CARA DIAZ", "CARA@example.com", "+4522222222"));
        await().atMost(Duration.ofSeconds(15)).untilAsserted(() ->
                assertThat(JsonPath.<String>read(list(salonId, "cara", null), "$.content[0].phone")).isEqualTo("+4522222222"));
        var after = list(salonId, "cara", null);
        assertThat(JsonPath.<Integer>read(after, "$.totalElements")).isEqualTo(1);
        assertThat(JsonPath.<String>read(after, "$.content[0].name")).isEqualTo("Cara D.");
        assertThat(JsonPath.<String>read(after, "$.content[0].notes")).isEqualTo("Allergic to ammonia");
    }

    @Test
    void detailShowsTheHistoryAndErasingRewritesIt() {
        var date = LocalDate.now().plusDays(3);
        long upcoming = booking(salonId, "dana@example.com", date, "CONFIRMED");
        long past = booking(salonId, "Dana@example.com", LocalDate.now().minusDays(10), "COMPLETED");
        String reviewToken = ratings.issueInvitation(past, salonId, staffId);
        client.get().uri("/api/public/rating/" + reviewToken).exchange().expectStatus().isOk();
        long theirOrder = order(salonId, "dana@example.com", "SO-2001");
        jdbc.update("INSERT INTO shop_order_activity (order_id, salon_id, type, message, actor, subject, body, created_at) " +
                "VALUES (?, ?, 'CUSTOMER_NOTIFIED', 'x', 'system', 'Hi Dana Dunn', 'Ships to 1 Main St', now())", theirOrder, salonId);
        long plan = jdbc.queryForObject("INSERT INTO membership_plan (salon_id, name, price, currency, billing_interval, status) " +
                "VALUES (?, 'Glow', 49, 'EUR', 'MONTHLY', 'ACTIVE') RETURNING id", Long.class, salonId);
        long sub = membership(salonId, plan, "dana@example.com", "ACTIVE");
        // Another customer of the same salon, and Dana in another salon, must be untouched.
        long bobBooking = booking(salonId, "bob@example.com", date, "CONFIRMED");
        long otherBooking = booking(otherSalonId, "dana@example.com", date, "CONFIRMED");

        var dana = create(salonId, "Dana Dunn", "dana@example.com", "+4533333333", null);

        var detail = get(salonId, dana);
        assertThat(JsonPath.<List<Object>>read(detail, "$.history.bookings")).hasSize(2);
        assertThat(JsonPath.<List<String>>read(detail, "$.history.orders[*].orderNumber")).containsExactly("SO-2001");
        assertThat(JsonPath.<List<String>>read(detail, "$.history.memberships[*].status")).containsExactly("ACTIVE");
        assertThat(JsonPath.<Boolean>read(detail, "$.canDelete")).isFalse();
        assertThat(JsonPath.<String>read(detail, "$.deleteBlockedReason")).contains("upcoming appointment");
        client.delete().uri("/api/salon-admin/{id}/customers/{c}", salonId, dana).exchange().expectStatus().isEqualTo(409);

        jdbc.update("UPDATE booking SET status = 'CANCELLED' WHERE id = ?", upcoming);
        assertThat(JsonPath.<String>read(get(salonId, dana), "$.deleteBlockedReason")).contains("active membership");
        client.delete().uri("/api/salon-admin/{id}/customers/{c}", salonId, dana).exchange().expectStatus().isEqualTo(409);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM salon_customer WHERE id = ?", Integer.class, dana)).as("nothing erased on refusal").isOne();

        jdbc.update("UPDATE membership_subscription SET status = 'CANCELLED' WHERE id = ?", sub);
        assertThat(JsonPath.<Boolean>read(get(salonId, dana), "$.canDelete")).isTrue();
        client.delete().uri("/api/salon-admin/{id}/customers/{c}", salonId, dana).exchange().expectStatus().isNoContent();
        client.delete().uri("/api/salon-admin/{id}/customers/{c}", salonId, dana).exchange().expectStatus().isNotFound();
        client.get().uri("/api/public/rating/" + reviewToken).exchange().expectStatus().isNotFound();
        client.post().uri("/api/public/rating/" + reviewToken).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("salonRating", 5, "staffRating", 5)).exchange().expectStatus().isBadRequest();

        assertThat(jdbc.queryForObject("SELECT count(*) FROM salon_customer WHERE id = ?", Integer.class, dana)).isZero();
        for (long id : new long[]{upcoming, past}) {
            var row = jdbc.queryForMap("SELECT customer_name, customer_email, customer_phone FROM booking WHERE id = ?", id);
            assertThat(row.get("customer_name")).isEqualTo("Deleted customer");
            assertThat((String) row.get("customer_email")).endsWith("@anonymized.invalid");
            assertThat(row.get("customer_phone")).isNull();
        }
        var orderRow = jdbc.queryForMap("SELECT customer_name, customer_email, ship_line1 FROM shop_order WHERE id = ?", theirOrder);
        assertThat(orderRow.get("customer_name")).isEqualTo("Deleted customer");
        assertThat((String) orderRow.get("customer_email")).endsWith("@anonymized.invalid");
        assertThat(orderRow.get("ship_line1")).isNull();
        var mail = jdbc.queryForMap("SELECT subject, body FROM shop_order_activity WHERE order_id = ? AND type = 'CUSTOMER_NOTIFIED'", theirOrder);
        assertThat(mail.get("subject")).isNull();
        assertThat(mail.get("body")).isNull();
        assertThat(jdbc.queryForObject("SELECT customer_name FROM membership_subscription WHERE id = ?", String.class, sub)).isEqualTo("Deleted customer");
        // The records themselves — amounts, lines, status — stay.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM shop_order_line WHERE order_id = ?", Integer.class, theirOrder)).isOne();

        assertThat(jdbc.queryForObject("SELECT customer_email FROM booking WHERE id = ?", String.class, bobBooking)).isEqualTo("bob@example.com");
        assertThat(jdbc.queryForObject("SELECT customer_email FROM booking WHERE id = ?", String.class, otherBooking)).isEqualTo("dana@example.com");
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private void publish(Object event) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> publisher.publishEvent(event));
    }

    private BookingCreatedEvent bookingCreated(String name, String email, String phone) {
        return new BookingCreatedEvent(1L, salonId, serviceId, staffId, name, email, phone, LocalDate.now().plusDays(1),
                LocalTime.of(10, 0), LocalTime.of(11, 0), BookingStatus.CONFIRMED, "Directory Salon", "+100000000", "salon@directory.test");
    }

    private RestTestClient.ResponseSpec post(UUID salon, String json) {
        return client.post().uri("/api/salon-admin/{id}/customers", salon).contentType(MediaType.APPLICATION_JSON).body(json).exchange();
    }

    private long create(UUID salon, String name, String email, String phone, String notes) {
        var json = "{\"name\":\"" + name + "\",\"email\":\"" + email + "\""
                + (phone == null ? "" : ",\"phone\":\"" + phone + "\"")
                + (notes == null ? "" : ",\"notes\":\"" + notes + "\"}");
        if (notes == null) json += "}";
        var body = post(salon, json).expectStatus().isCreated().expectBody().returnResult().getResponseBody();
        return JsonPath.<Integer>read(new String(body, StandardCharsets.UTF_8), "$.id").longValue();
    }

    private String list(UUID salon, String q, String sort) {
        var body = client.get().uri(b -> {
                    b.path("/api/salon-admin/{id}/customers");
                    if (q != null) b.queryParam("q", "{q}");
                    if (sort != null) b.queryParam("sort", sort);
                    return b.build(q == null ? new Object[]{salon} : new Object[]{salon, q});
                }).exchange()
                .expectStatus().isOk().expectBody().returnResult().getResponseBody();
        return new String(body, StandardCharsets.UTF_8);
    }

    private String get(UUID salon, long id) {
        var body = client.get().uri("/api/salon-admin/{id}/customers/{c}", salon, id).exchange()
                .expectStatus().isOk().expectBody().returnResult().getResponseBody();
        return new String(body, StandardCharsets.UTF_8);
    }

    private UUID salon(String name) {
        var id = UUID.randomUUID();
        jdbc.update("INSERT INTO salon (id, name, handler, owner_name, owner_email, contact_email, contact_phone, created_at) " +
                        "VALUES (?, ?, ?, 'Owner', 'owner@directory.test', 'salon@directory.test', '+100000000', now())",
                id, name, "dir-" + id.toString().substring(0, 8));
        return id;
    }

    private long booking(UUID salon, String email, LocalDate date, String status) {
        return jdbc.queryForObject("INSERT INTO booking (salon_id, service_id, staff_id, customer_name, customer_email, customer_phone, appointment_date, " +
                "start_time, end_time, status, created_at) VALUES (?, ?, ?, 'Customer Name', ?, '+4500000000', ?, '10:00', '11:00', ?, now()) RETURNING id",
                Long.class, salon, serviceId, staffId, email, date, status);
    }

    private long order(UUID salon, String email, String number) {
        long id = jdbc.queryForObject("INSERT INTO shop_order (salon_id, order_number, customer_name, customer_email, customer_phone, status, payment_status, " +
                "subtotal, currency, ship_line1, ship_city, created_at) VALUES (?, ?, 'Dana Dunn', ?, '+4533333333', 'NEW', 'PAID', 25, 'EUR', '1 Main St', 'Aarhus', now()) RETURNING id",
                Long.class, salon, number, email);
        jdbc.update("INSERT INTO shop_order_line (order_id, order_key, product_name, variant_label, unit_price, quantity, line_total) " +
                "VALUES (?, 0, 'Shampoo', '250 ml', 12.5, 2, 25)", id);
        return id;
    }

    private long membership(UUID salon, long plan, String email, String status) {
        var suffix = UUID.randomUUID().toString().replace("-", "");
        return jdbc.queryForObject("INSERT INTO membership_subscription (salon_id, plan_id, plan_name, member_code, renewal_token, customer_name, " +
                        "customer_email, status, price, currency, billing_interval, started_at, current_period_end) " +
                        "VALUES (?, ?, 'Glow', ?, ?, 'Dana Dunn', ?, ?, 49, 'EUR', 'MONTHLY', now(), ?) RETURNING id",
                Long.class, salon, plan, suffix.substring(0, 10).toUpperCase(), suffix, email, status,
                Timestamp.from(Instant.now().plus(30, ChronoUnit.DAYS)));
    }
}
