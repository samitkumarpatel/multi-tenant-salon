package net.samitkumar.multi_tenant_salon.loyalty;

import com.jayway.jsonpath.JsonPath;
import net.samitkumar.multi_tenant_salon.MultiTenantSalonApplication;
import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import net.samitkumar.multi_tenant_salon.booking.BookingStatusChangedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderStatus;
import net.samitkumar.multi_tenant_salon.shop.OrderStatusChangedEvent;
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
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

/** Points are earned from completed visits, spent on rewards, and the ledger stays the single source of truth. */
@SpringBootTest(classes = MultiTenantSalonApplication.class)
@Import(TestcontainersConfiguration.class)
class LoyaltyIntegrationTest {
    static final String EMAIL = "lena@example.com";

    @Autowired JdbcTemplate jdbc;
    @Autowired LoyaltyApi loyalty;
    @Autowired ApplicationEventPublisher publisher;
    @Autowired PlatformTransactionManager transactionManager;

    RestTestClient client;
    UUID salonId;
    long serviceId;
    long staffId;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
        salonId = UUID.randomUUID();
        jdbc.update("INSERT INTO salon (id, name, handler, owner_name, owner_email, contact_email, contact_phone, created_at) " +
                "VALUES (?, 'Loyal Salon', ?, 'Owner', 'owner@loyal.test', 'salon@loyal.test', '+100000000', now())",
                salonId, "loyal-" + salonId.toString().substring(0, 8));
        jdbc.update("INSERT INTO salon_feature (salon_id, salon_key, feature) VALUES (?, 0, 'LOYALTY_PROGRAM')", salonId);
        serviceId = jdbc.queryForObject("INSERT INTO service_item (salon_id, name, category, price, currency, duration_minutes, active, created_at) " +
                "VALUES (?, 'Colour', 'HAIR', 40, 'EUR', 60, true, now()) RETURNING id", Long.class, salonId);
        staffId = jdbc.queryForObject("INSERT INTO staff_member (salon_id, name, role, status, created_at) " +
                "VALUES (?, 'Sam Stylist', 'STYLIST', 'ACTIVE', now()) RETURNING id", Long.class, salonId);
    }

    @Test
    void earnRedeemCancelAndAdjust() {
        // Nothing happens until the owner turns the programme on.
        long early = booking("COMPLETED");
        publishStatus(early, BookingStatus.COMPLETED);
        client.get().uri("/api/salon/{s}/loyalty", salonId).exchange().expectStatus().isOk();
        assertThat(loyalty.forCustomer(salonId, EMAIL).enabled()).isFalse();
        assertThat(ledgerRows()).isZero();

        put("/program", "{\"enabled\":true,\"pointsPerUnit\":1.5}").expectStatus().isOk();
        long reward = createReward("Free blow-dry", 50);
        createReward("Hair mask", 500);
        put("/program", "{\"pointsPerUnit\":-1}").expectStatus().isBadRequest();

        // A completed 40.00 visit earns 60 points; redelivering the event changes nothing.
        long visit = booking("COMPLETED");
        publishStatus(visit, BookingStatus.COMPLETED);
        await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> assertThat(loyalty.forCustomer(salonId, EMAIL).balance()).isEqualTo(60));
        publishStatus(visit, BookingStatus.COMPLETED);
        publishStatus(visit, BookingStatus.CONFIRMED);
        await().during(Duration.ofSeconds(2)).atMost(Duration.ofSeconds(8)).untilAsserted(() ->
                assertThat(loyalty.forCustomer(salonId, "LENA@example.com").balance()).as("case-insensitive, no double earn").isEqualTo(60));

        // A no-show takes the points back, once.
        long noShow = booking("COMPLETED");
        publishStatus(noShow, BookingStatus.COMPLETED);
        await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> assertThat(loyalty.forCustomer(salonId, EMAIL).balance()).isEqualTo(120));
        publishStatus(noShow, BookingStatus.NO_SHOW);
        publishStatus(noShow, BookingStatus.NO_SHOW);
        await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> assertThat(loyalty.forCustomer(salonId, EMAIL).balance()).isEqualTo(60));

        // Redeeming spends points and issues a code; the expensive reward is out of reach.
        var redemption = loyalty.redeem(salonId, EMAIL, reward);
        assertThat(redemption.code()).hasSize(8);
        assertThat(loyalty.forCustomer(salonId, EMAIL).balance()).isEqualTo(10);
        long expensive = jdbc.queryForObject("SELECT id FROM loyalty_reward WHERE salon_id = ? AND points_cost = 500", Long.class, salonId);
        assertThatThrownBy(() -> loyalty.redeem(salonId, EMAIL, expensive)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("Not enough points");
        assertThatThrownBy(() -> loyalty.redeem(salonId, EMAIL, 999_999L)).isInstanceOf(ResponseStatusException.class).hasMessageContaining("Reward not found");

        // The desk finds the code and hands it over once; the owner can then no longer void it.
        var byCode = client.get().uri("/api/salon-admin/{s}/loyalty/redemptions/by-code/{c}", salonId, redemption.code().toLowerCase())
                .exchange().expectStatus().isOk().returnResult(String.class).getResponseBody();
        assertThat(JsonPath.<String>read(byCode, "$.status")).isEqualTo("ISSUED");
        client.post().uri("/api/salon-admin/{s}/loyalty/redemptions/{id}/use", salonId, redemption.id()).exchange().expectStatus().isOk();
        client.post().uri("/api/salon-admin/{s}/loyalty/redemptions/{id}/use", salonId, redemption.id()).exchange().expectStatus().isEqualTo(409);
        client.post().uri("/api/salon-admin/{s}/loyalty/redemptions/{id}/cancel", salonId, redemption.id()).exchange().expectStatus().isEqualTo(409);
    }

    @Test
    void cancelRefundsOnceAndAdjustmentsNeedAReason() {
        put("/program", "{\"enabled\":true}").expectStatus().isOk();
        long reward = createReward("Free blow-dry", 50);
        adjust(EMAIL, 120, "Welcome bonus").expectStatus().isOk();
        adjust(EMAIL, 10, " ").expectStatus().isBadRequest();
        adjust(EMAIL, 0, "nothing").expectStatus().isBadRequest();
        adjust(EMAIL, -500, "too much").expectStatus().isEqualTo(409);

        var redemption = loyalty.redeem(salonId, EMAIL, reward);
        assertThat(loyalty.forCustomer(salonId, EMAIL).balance()).isEqualTo(70);
        client.post().uri("/api/salon-admin/{s}/loyalty/redemptions/{id}/cancel", salonId, redemption.id()).exchange().expectStatus().isOk();
        client.post().uri("/api/salon-admin/{s}/loyalty/redemptions/{id}/cancel", salonId, redemption.id()).exchange().expectStatus().isEqualTo(409);
        assertThat(loyalty.forCustomer(salonId, EMAIL).balance()).as("refunded once").isEqualTo(120);

        var members = client.get().uri("/api/salon-admin/{s}/loyalty/members?q=lena", salonId).exchange().expectStatus().isOk()
                .returnResult(String.class).getResponseBody();
        assertThat(JsonPath.<Integer>read(members, "$[0].balance")).isEqualTo(120);
        assertThat(JsonPath.<Integer>read(members, "$.length()")).isEqualTo(1);
    }

    @Test
    void concurrentRedemptionsCannotOverspend() throws Exception {
        put("/program", "{\"enabled\":true}").expectStatus().isOk();
        long reward = createReward("Free blow-dry", 50);
        adjust(EMAIL, 100, "Seed").expectStatus().isOk(); // enough for exactly two
        try (var pool = Executors.newFixedThreadPool(5)) {
            var results = pool.invokeAll(java.util.Collections.nCopies(5, (Callable<Boolean>) () -> {
                try { loyalty.redeem(salonId, EMAIL, reward); return true; } catch (ResponseStatusException e) { return false; }
            }));
            long ok = 0;
            for (var f : results) if (f.get()) ok++;
            assertThat(ok).isEqualTo(2);
        }
        assertThat(loyalty.forCustomer(salonId, EMAIL).balance()).isZero();
    }

    @Test
    void expiryTakesOnlyUnspentOldPointsAndIsIdempotent() {
        put("/program", "{\"enabled\":true,\"expiryMonths\":6}").expectStatus().isOk();
        long reward = createReward("Free blow-dry", 50);
        // Two earns, both already past their expiry; the customer then spends 50 (drawn from the oldest first).
        jdbc.update("INSERT INTO loyalty_ledger (salon_id, email, delta, reason, source_type, source_id, expires_at, created_at) VALUES (?, ?, 80, 'EARN_BOOKING', 'BOOKING', 'a', now() - interval '1 day', now() - interval '200 days')", salonId, EMAIL);
        jdbc.update("INSERT INTO loyalty_ledger (salon_id, email, delta, reason, source_type, source_id, expires_at, created_at) VALUES (?, ?, 40, 'EARN_BOOKING', 'BOOKING', 'b', now() + interval '30 days', now() - interval '10 days')", salonId, EMAIL);
        loyalty.redeem(salonId, EMAIL, reward);
        assertThat(loyalty.forCustomer(salonId, EMAIL).balance()).isEqualTo(70);

        int expired = loyalty.expireDue();
        assertThat(expired).isEqualTo(1);
        // 80 earned, 50 spent against it first, so only 30 are lost; the unexpired 40 stays.
        assertThat(loyalty.forCustomer(salonId, EMAIL).balance()).isEqualTo(40);
        assertThat(loyalty.expireDue()).as("second run is a no-op").isZero();
        assertThat(loyalty.forCustomer(salonId, EMAIL).balance()).isEqualTo(40);
    }

    @Test
    void orderEarnsOnSubtotalAndCancellationReverses() {
        put("/program", "{\"enabled\":true}").expectStatus().isOk();
        jdbc.update("INSERT INTO shop_order (salon_id, order_number, customer_name, customer_email, customer_phone, status, payment_status, subtotal, currency, ship_line1, ship_city, created_at) " +
                "VALUES (?, 'SO-L1', 'Lena', ?, '+4500000000', 'NEW', 'PAID', 25, 'EUR', '1 Main St', 'Aarhus', now())", salonId, EMAIL);
        long orderId = jdbc.queryForObject("SELECT id FROM shop_order WHERE order_number = 'SO-L1' AND salon_id = ?", Long.class, salonId);
        publish(new net.samitkumar.multi_tenant_salon.shop.OrderPlacedEvent(orderId, salonId, "SO-L1", "Lena", EMAIL, "+4500000000", 2,
                new java.math.BigDecimal("25.00"), "EUR", "Loyal Salon", "+100000000", "salon@loyal.test", null, null, new java.math.BigDecimal("5.00")));
        await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> assertThat(loyalty.forCustomer(salonId, EMAIL).balance()).as("shipping is not spend").isEqualTo(25));
        publish(new OrderStatusChangedEvent(orderId, salonId, "SO-L1", OrderStatus.CANCELLED, "Lena", EMAIL, "Loyal Salon", null, null, null));
        await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> assertThat(loyalty.forCustomer(salonId, EMAIL).balance()).isZero());
    }

    @Test
    void erasingACustomerRewritesTheirLoyaltyRows() {
        put("/program", "{\"enabled\":true}").expectStatus().isOk();
        adjust(EMAIL, 10, "Hello").expectStatus().isOk();
        loyalty.anonymizeCustomer(salonId, EMAIL, "deleted-x@anonymized.invalid");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM loyalty_ledger WHERE salon_id = ? AND email = ?", Integer.class, salonId, EMAIL)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM loyalty_ledger WHERE salon_id = ? AND email = 'deleted-x@anonymized.invalid'", Integer.class, salonId)).isOne();
    }

    @Test
    void customerSeesOnlyTheirOwnPointsAndCanRedeemWithASession() {
        put("/program", "{\"enabled\":true}").expectStatus().isOk();
        long reward = createReward("Free blow-dry", 50);
        adjust(EMAIL, 80, "Welcome").expectStatus().isOk();
        adjust("other@example.com", 500, "Someone else's points").expectStatus().isOk();

        client.get().uri("/api/salon/{s}/account/loyalty", salonId).exchange().expectStatus().isUnauthorized();
        var mine = client.get().uri("/api/salon/{s}/account/loyalty", salonId).header("X-Customer-Session", session(EMAIL))
                .exchange().expectStatus().isOk().returnResult(String.class).getResponseBody();
        assertThat(JsonPath.<Integer>read(mine, "$.balance")).isEqualTo(80);
        assertThat(JsonPath.<Boolean>read(mine, "$.enabled")).isTrue();
        assertThat(JsonPath.<Integer>read(mine, "$.rewards.length()")).isEqualTo(1);

        var redeemed = client.post().uri("/api/salon/{s}/account/loyalty/rewards/{r}/redeem", salonId, reward)
                .header("X-Customer-Session", session(EMAIL)).exchange().expectStatus().isOk().returnResult(String.class).getResponseBody();
        assertThat(JsonPath.<String>read(redeemed, "$.status")).isEqualTo("ISSUED");
        assertThat(loyalty.forCustomer(salonId, EMAIL).balance()).isEqualTo(30);
        assertThat(loyalty.forCustomer(salonId, "other@example.com").balance()).as("other customers are untouched").isEqualTo(500);
        client.post().uri("/api/salon/{s}/account/loyalty/rewards/{r}/redeem", salonId, reward)
                .header("X-Customer-Session", session(EMAIL)).exchange().expectStatus().isEqualTo(409);

        // The public rules never carry a customer's data.
        var rules = client.get().uri("/api/salon/{s}/loyalty", salonId).exchange().expectStatus().isOk().returnResult(String.class).getResponseBody();
        assertThat(JsonPath.<Integer>read(rules, "$.balance")).isZero();
        assertThat(JsonPath.<Integer>read(rules, "$.history.length()")).isZero();
        assertThat(JsonPath.<Integer>read(rules, "$.rewards.length()")).isEqualTo(1);
    }

    // ── helpers ──

    private String session(String email) {
        try {
            var token = "tok-" + UUID.randomUUID();
            var hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
            jdbc.update("INSERT INTO customer_session (salon_id, email, token_hash, expires_at) VALUES (?, ?, ?, ?)",
                    salonId, email, hash, Timestamp.from(Instant.now().plus(1, ChronoUnit.DAYS)));
            return token;
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }


    private long booking(String status) {
        return jdbc.queryForObject("INSERT INTO booking (salon_id, service_id, staff_id, customer_name, customer_email, customer_phone, appointment_date, " +
                "start_time, end_time, status, created_at) VALUES (?, ?, ?, 'Lena', ?, '+4500000000', ?, '10:00', '11:00', ?, now()) RETURNING id",
                Long.class, salonId, serviceId, staffId, EMAIL, LocalDate.now().minusDays(1), status);
    }

    private void publishStatus(long bookingId, BookingStatus status) {
        publish(new BookingStatusChangedEvent(bookingId, salonId, status, "Lena", EMAIL, "+4500000000", LocalDate.now().minusDays(1),
                LocalTime.of(10, 0), LocalTime.of(11, 0), "Loyal Salon", "+100000000", "salon@loyal.test"));
    }

    private void publish(Object event) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> publisher.publishEvent(event));
    }

    private int ledgerRows() {
        return jdbc.queryForObject("SELECT count(*) FROM loyalty_ledger WHERE salon_id = ?", Integer.class, salonId);
    }

    private long createReward(String name, int cost) {
        var body = client.post().uri("/api/salon-admin/{s}/loyalty/rewards", salonId).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("name", name, "pointsCost", cost, "type", "CUSTOM")).exchange().expectStatus().isCreated()
                .returnResult(String.class).getResponseBody();
        return JsonPath.<Number>read(body, "$.id").longValue();
    }

    private RestTestClient.ResponseSpec put(String path, String json) {
        return client.put().uri("/api/salon-admin/{s}/loyalty" + path, salonId).contentType(MediaType.APPLICATION_JSON).body(json).exchange();
    }

    private RestTestClient.ResponseSpec adjust(String email, int points, String note) {
        return client.post().uri("/api/salon-admin/{s}/loyalty/adjustments", salonId).contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("email", email, "points", points, "note", note)).exchange();
    }
}
