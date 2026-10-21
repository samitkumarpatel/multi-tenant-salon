package net.samitkumar.multi_tenant_salon.membership;

import com.jayway.jsonpath.JsonPath;
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

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Plan management and the public catalogue. The paid sign-up flow is covered by {@code membership.internal.MembershipSubscriptionFlowTests}. */
@ApplicationModuleTest(mode = ApplicationModuleTest.BootstrapMode.ALL_DEPENDENCIES)
@Import(TestcontainersConfiguration.class)
class MembershipModuleTests {

    @Autowired
    JdbcTemplate jdbcTemplate;

    RestTestClient client;
    UUID salonId;
    long serviceId;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
        salonId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO salon (id, name, handler, owner_name, owner_email, contact_email, contact_phone, created_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, now())",
                salonId, "Member Salon", "member-" + salonId.toString().substring(0, 8),
                "Owner", "owner@member.test", "salon@member.test", "+100000000");
        jdbcTemplate.update("INSERT INTO salon_feature (salon_id, feature) VALUES (?, 'MEMBERSHIP')", salonId);
        serviceId = jdbcTemplate.queryForObject(
                "INSERT INTO service_item (salon_id, name, price, currency, duration_minutes, category, active, created_at) " +
                        "VALUES (?, 'Blow dry', 35.00, 'EUR', 45, 'HAIR', true, now()) RETURNING id", Long.class, salonId);
    }

    private String adminBase() { return "/api/salon-admin/" + salonId + "/membership"; }
    private String publicBase() { return "/api/salon/" + salonId + "/membership"; }

    private long createPlan(String body) {
        var result = client.post().uri(adminBase() + "/plans").contentType(MediaType.APPLICATION_JSON).body(body)
                .exchange().expectStatus().isCreated().expectBody().returnResult();
        return ((Number) JsonPath.read(new String(result.getResponseBody(), StandardCharsets.UTF_8), "$.id")).longValue();
    }

    @Test
    void planLifecycleAndPublicCatalogue() {
        long planId = createPlan("""
                {
                  "name": "Glow Monthly", "description": "Look great all month",
                  "price": 49.00, "currency": "eur", "billingInterval": "MONTHLY",
                  "signupFee": 10, "serviceDiscountPercent": 10, "maxMembers": 20, "highlighted": true,
                  "perks": ["Priority booking", "  ", "Free drink"],
                  "includedServices": [ { "serviceId": %d, "quantityPerCycle": 2 } ]
                }
                """.formatted(serviceId));

        client.get().uri(adminBase() + "/plans/" + planId).exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.status").isEqualTo("DRAFT")
                .jsonPath("$.currency").isEqualTo("EUR")
                .jsonPath("$.perks.length()").isEqualTo(2)
                .jsonPath("$.perks[0]").isEqualTo("Priority booking")
                .jsonPath("$.includedServices[0].name").isEqualTo("Blow dry")
                .jsonPath("$.includedServices[0].quantityPerCycle").isEqualTo(2)
                .jsonPath("$.includedValue").isEqualTo(70.0)
                .jsonPath("$.spotsLeft").isEqualTo(20)
                .jsonPath("$.activeMembers").isEqualTo(0);

        // Drafts stay off the public site.
        client.get().uri(publicBase() + "/plans").exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.plans.length()").isEqualTo(0)
                .jsonPath("$.onlineSignup").isEqualTo(false);

        client.put().uri(adminBase() + "/plans/" + planId).contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "name": "Glow Monthly", "price": 49.00, "currency": "EUR", "billingInterval": "MONTHLY",
                          "status": "ACTIVE", "perks": ["Priority booking"] }
                        """)
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.status").isEqualTo("ACTIVE")
                .jsonPath("$.includedServices.length()").isEqualTo(0);

        client.get().uri(publicBase() + "/plans").exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.plans.length()").isEqualTo(1)
                .jsonPath("$.plans[0].name").isEqualTo("Glow Monthly")
                .jsonPath("$.plans[0].activeMembers").doesNotHaveJsonPath();

        client.delete().uri(adminBase() + "/plans/" + planId).exchange().expectStatus().isNoContent();
        client.get().uri(adminBase() + "/plans").exchange()
                .expectStatus().isOk().expectBody().jsonPath("$.length()").isEqualTo(0);
    }

    @Test
    void plansAreReorderable() {
        long first = createPlan("""
                { "name": "Basic", "price": 20, "currency": "EUR", "billingInterval": "MONTHLY" }""");
        long second = createPlan("""
                { "name": "Premium", "price": 500, "currency": "EUR", "billingInterval": "YEARLY" }""");

        client.put().uri(adminBase() + "/plans/order").contentType(MediaType.APPLICATION_JSON)
                .body("{ \"planIds\": [%d, %d] }".formatted(second, first))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$[0].name").isEqualTo("Premium")
                .jsonPath("$[1].name").isEqualTo("Basic");
    }

    @Test
    void rejectsInvalidPlans() {
        for (var body : new String[]{
                "{ \"price\": 10, \"currency\": \"EUR\", \"billingInterval\": \"MONTHLY\" }",
                "{ \"name\": \"Free\", \"price\": 0, \"currency\": \"EUR\", \"billingInterval\": \"MONTHLY\" }",
                "{ \"name\": \"X\", \"price\": 10, \"currency\": \"EURO\", \"billingInterval\": \"MONTHLY\" }",
                "{ \"name\": \"X\", \"price\": 10, \"currency\": \"EUR\" }",
                "{ \"name\": \"X\", \"price\": 10, \"currency\": \"EUR\", \"billingInterval\": \"MONTHLY\", \"serviceDiscountPercent\": 120 }",
                "{ \"name\": \"X\", \"price\": 10, \"currency\": \"EUR\", \"billingInterval\": \"MONTHLY\", \"maxMembers\": 0 }",
                "{ \"name\": \"X\", \"price\": 10, \"currency\": \"EUR\", \"billingInterval\": \"MONTHLY\", \"includedServices\": [ { \"serviceId\": 999999999, \"quantityPerCycle\": 1 } ] }"
        }) {
            client.post().uri(adminBase() + "/plans").contentType(MediaType.APPLICATION_JSON).body(body)
                    .exchange().expectStatus().isBadRequest();
        }
    }

    @Test
    void planWithMembersCanOnlyBeArchived() {
        long planId = createPlan("""
                { "name": "Regulars", "price": 30, "currency": "EUR", "billingInterval": "MONTHLY", "status": "ACTIVE" }""");
        jdbcTemplate.update("""
                INSERT INTO membership_subscription (salon_id, plan_id, plan_name, member_code, renewal_token, customer_name, customer_email,
                  status, price, currency, billing_interval) VALUES (?, ?, 'Regulars', ?, ?, 'Ann', 'ann@example.com', 'ACTIVE', 30, 'EUR', 'MONTHLY')""",
                salonId, planId, "MTEST" + salonId.toString().substring(0, 4).toUpperCase(), "tok-" + salonId);

        client.delete().uri(adminBase() + "/plans/" + planId).exchange().expectStatus().isEqualTo(409);

        client.put().uri(adminBase() + "/plans/" + planId).contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "name": "Regulars", "price": 30, "currency": "EUR", "billingInterval": "MONTHLY", "status": "ARCHIVED" }""")
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.status").isEqualTo("ARCHIVED")
                .jsonPath("$.activeMembers").isEqualTo(1);
        client.get().uri(publicBase() + "/plans").exchange()
                .expectStatus().isOk().expectBody().jsonPath("$.plans.length()").isEqualTo(0);
    }

    @Test
    void publicCatalogueNeedsTheMembershipFeature() {
        jdbcTemplate.update("DELETE FROM salon_feature WHERE salon_id = ?", salonId);
        client.get().uri(publicBase() + "/plans").exchange().expectStatus().isNotFound();
    }

    @Test
    void signupIsRefusedWhileOnlinePaymentIsOff() {
        long planId = createPlan("""
                { "name": "Regulars", "price": 30, "currency": "EUR", "billingInterval": "MONTHLY", "status": "ACTIVE" }""");
        client.post().uri(publicBase() + "/checkout").contentType(MediaType.APPLICATION_JSON)
                .body("{ \"planId\": %d, \"customerName\": \"Ann\", \"customerEmail\": \"ann@example.com\" }".formatted(planId))
                .exchange().expectStatus().isEqualTo(409);
    }
}
