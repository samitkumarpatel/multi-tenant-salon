package net.samitkumar.multi_tenant_salon.dashboard;

import net.samitkumar.multi_tenant_salon.MultiTenantSalonApplication;
import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import net.samitkumar.multi_tenant_salon.loyalty.LoyaltyApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.context.WebApplicationContext;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/** The till earns loyalty points on what it sells, spends discount rewards, and gives both back when a sale is voided. */
@SpringBootTest(classes = MultiTenantSalonApplication.class)
@Import(TestcontainersConfiguration.class)
class CounterLoyaltyIntegrationTest {
    static final String EMAIL = "lena@example.com";

    @Autowired JdbcTemplate jdbc;
    @Autowired LoyaltyApi loyalty;

    RestTestClient client;
    UUID salonId;
    long serviceId;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
        salonId = UUID.randomUUID();
        jdbc.update("INSERT INTO salon (id, name, handler, owner_name, owner_email, created_at) VALUES (?, 'Counter Salon', ?, 'Owner', 'owner@counter.test', now())",
                salonId, "counter-" + salonId.toString().substring(0, 8));
        jdbc.update("INSERT INTO salon_feature (salon_id, salon_key, feature) VALUES (?, 0, 'DASHBOARD')", salonId);
        jdbc.update("INSERT INTO salon_feature (salon_id, salon_key, feature) VALUES (?, 1, 'LOYALTY_PROGRAM')", salonId);
        jdbc.update("INSERT INTO loyalty_program (salon_id, enabled, points_per_unit) VALUES (?, true, 1)", salonId);
        serviceId = jdbc.queryForObject("INSERT INTO service_item (salon_id, name, category, price, currency, duration_minutes, active, created_at) " +
                "VALUES (?, 'Cut', 'HAIR', 50, 'EUR', 30, true, now()) RETURNING id", Long.class, salonId);
    }

    private int balance() {
        return loyalty.forCustomer(salonId, EMAIL).balance();
    }

    private String sell(String extra, int expectedStatus) {
        var body = client.post().uri("/api/salon-admin/{s}/dashboard/sales", salonId).contentType(MediaType.APPLICATION_JSON)
                .body("{\"paymentMethod\":\"CASH\",\"customerEmail\":\"" + EMAIL + "\",\"items\":[{\"sourceType\":\"SERVICE\",\"sourceId\":"
                        + serviceId + ",\"quantity\":2}]," + extra + "\"idempotencyKey\":\"" + UUID.randomUUID() + "\"}")
                .exchange().expectStatus().isEqualTo(expectedStatus).returnResult(String.class).getResponseBody();
        return body;
    }

    private long reward(String type, String value, int cost) {
        return jdbc.queryForObject("INSERT INTO loyalty_reward (salon_id, name, points_cost, reward_type, reward_value) VALUES (?, ?, ?, ?, ?::numeric) RETURNING id",
                Long.class, salonId, "Reward " + type, cost, type, value);
    }

    @Test
    void aTillSaleEarnsPointsWithoutTheTipAndAVoidTakesThemBack() {
        var body = sell("\"tipAmount\":5,", 200); // 2 x 50 = 100 earnable; the tip is not spend
        await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> assertThat(balance()).isEqualTo(100));
        long saleId = ((Number) com.jayway.jsonpath.JsonPath.read(body, "$.id")).longValue();
        client.post().uri("/api/salon-admin/{s}/dashboard/sales/{id}/void", salonId, saleId)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isOk();
        await().atMost(Duration.ofSeconds(15)).untilAsserted(() -> assertThat(balance()).isZero());
    }

    @Test
    void aDiscountRewardCodeComesOffTheSaleIsSpentOnceAndReturnsOnVoid() {
        jdbc.update("INSERT INTO loyalty_ledger (salon_id, email, delta, reason) VALUES (?, ?, 100, 'ADJUST')", salonId, EMAIL);
        var redemption = loyalty.redeem(salonId, EMAIL, reward("DISCOUNT_AMOUNT", "10", 20));

        var body = sell("\"loyaltyCode\":\"" + redemption.code() + "\",", 200);
        assertThat((Number) com.jayway.jsonpath.JsonPath.read(body, "$.total")).hasToString("90.0");
        assertThat((String) com.jayway.jsonpath.JsonPath.read(body, "$.discountReason")).startsWith("Reward:");
        assertThat(jdbc.queryForObject("SELECT status FROM loyalty_redemption WHERE id = ?", String.class, redemption.id())).isEqualTo("USED");
        sell("\"loyaltyCode\":\"" + redemption.code() + "\",", 409); // already spent
        sell("\"loyaltyCode\":\"NOSUCH\",", 404);

        long saleId = ((Number) com.jayway.jsonpath.JsonPath.read(body, "$.id")).longValue();
        client.post().uri("/api/salon-admin/{s}/dashboard/sales/{id}/void", salonId, saleId)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isOk();
        assertThat(jdbc.queryForObject("SELECT status FROM loyalty_redemption WHERE id = ?", String.class, redemption.id())).isEqualTo("ISSUED");
    }

    @Test
    void aRewardHandedOverByHandIsNotTakenOffTheSale() {
        jdbc.update("INSERT INTO loyalty_ledger (salon_id, email, delta, reason) VALUES (?, ?, 100, 'ADJUST')", salonId, EMAIL);
        var redemption = loyalty.redeem(salonId, EMAIL, reward("FREE_SERVICE", "0", 20));
        sell("\"loyaltyCode\":\"" + redemption.code() + "\",", 409);
        assertThat(jdbc.queryForObject("SELECT status FROM loyalty_redemption WHERE id = ?", String.class, redemption.id())).isEqualTo("ISSUED");
    }

    private void member(String email, int included, int servicePct) {
        long plan = jdbc.queryForObject("INSERT INTO membership_plan (salon_id, name, price, currency, billing_interval, status, service_discount_percent) " +
                "VALUES (?, 'Gold', 49, 'EUR', 'MONTHLY', 'ACTIVE', ?) RETURNING id", Long.class, salonId, servicePct);
        jdbc.update("INSERT INTO membership_plan_service (plan_id, sort_key, service_id, quantity_per_cycle) VALUES (?, 0, ?, ?)", plan, serviceId, included);
        var code = UUID.randomUUID().toString().replace("-", "");
        jdbc.update("INSERT INTO membership_subscription (salon_id, plan_id, plan_name, member_code, renewal_token, customer_name, customer_email, status, price, currency, " +
                "billing_interval, started_at, current_period_end) VALUES (?, ?, 'Gold', ?, ?, 'Lena', ?, 'ACTIVE', 49, 'EUR', 'MONTHLY', now(), ?)",
                salonId, plan, code.substring(0, 10).toUpperCase(), code, email, java.sql.Timestamp.from(java.time.Instant.now().plus(java.time.Duration.ofDays(30))));
    }

    @Test
    void aMembersIncludedServicesAreFreeUntilTheAllowanceRunsOutAndComeBackOnVoid() {
        member(EMAIL, 1, 20); // 1 free cut a cycle, then 20% off services
        // 2 cuts at 50: one included (-50), the other 20% off (-10) -> 40 to pay.
        var first = sell("\"applyMembership\":true,", 200);
        assertThat((Number) com.jayway.jsonpath.JsonPath.read(first, "$.total")).hasToString("40.0");
        assertThat((String) com.jayway.jsonpath.JsonPath.read(first, "$.discountReason")).startsWith("Membership: Gold");
        // The allowance is spent: both cuts are now only 20% off -> 80.
        var second = sell("\"applyMembership\":true,", 200);
        assertThat((Number) com.jayway.jsonpath.JsonPath.read(second, "$.total")).hasToString("80.0");
        // Voiding the first sale gives the included cut back.
        long firstId = ((Number) com.jayway.jsonpath.JsonPath.read(first, "$.id")).longValue();
        client.post().uri("/api/salon-admin/{s}/dashboard/sales/{id}/void", salonId, firstId)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isOk();
        var third = sell("\"applyMembership\":true,", 200);
        assertThat((Number) com.jayway.jsonpath.JsonPath.read(third, "$.total")).hasToString("40.0");
    }

    @Test
    void membershipIsRefusedForANonMember() {
        sell("\"applyMembership\":true,", 409);
    }
}
