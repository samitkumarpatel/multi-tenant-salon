package net.samitkumar.multi_tenant_salon.customer;

import com.jayway.jsonpath.JsonPath;
import net.samitkumar.multi_tenant_salon.MultiTenantSalonApplication;
import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Customer self-service account, phase 1: emailed one-time code → session → read-only history of the
 * customer's bookings, orders and memberships in one salon, and nothing of anyone else's.
 */
@SpringBootTest(classes = MultiTenantSalonApplication.class)
@Import(TestcontainersConfiguration.class)
@RecordApplicationEvents
class CustomerAccountIntegrationTest {

    private static final String SESSION = "X-Customer-Session";

    @Autowired JdbcTemplate jdbc;
    @Autowired ApplicationEvents events;

    RestTestClient client;
    UUID salonId;
    UUID otherSalonId;
    // Every test signs in from its own address so the per-IP limit never couples them.
    String clientIp;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
        clientIp = "203.0.113." + (int) (Math.random() * 250 + 1) + "-" + UUID.randomUUID().toString().substring(0, 6);
        salonId = salon("Account Salon");
        otherSalonId = salon("Other Salon");

        long service = jdbc.queryForObject("INSERT INTO service_item (salon_id, name, category, price, currency, duration_minutes, active, created_at) " +
                "VALUES (?, 'Haircut', 'HAIR', 40, 'EUR', 60, true, now()) RETURNING id", Long.class, salonId);
        long staff = jdbc.queryForObject("INSERT INTO staff_member (salon_id, name, role, status, created_at) " +
                "VALUES (?, 'Sam Stylist', 'STYLIST', 'ACTIVE', now()) RETURNING id", Long.class, salonId);
        var date = LocalDate.now().plusDays(7);
        booking(salonId, service, staff, "Ann@Example.com", date);
        booking(salonId, service, staff, "bob@example.com", date);

        long paid = order(salonId, "ann@example.com", "PAID", "SO-1001");
        jdbc.update("INSERT INTO shop_order_activity (order_id, salon_id, type, message, actor, created_at) VALUES (?, ?, 'ORDER_PLACED', 'Order SO-1001 placed', 'system', now())", paid, salonId);
        jdbc.update("INSERT INTO shop_order_activity (order_id, salon_id, type, message, actor, created_at) VALUES (?, ?, 'WORK_NOTE', 'customer is difficult', 'owner', now())", paid, salonId);
        jdbc.update("INSERT INTO shop_order_activity (order_id, salon_id, type, message, actor, subject, body, created_at) " +
                "VALUES (?, ?, 'CUSTOMER_NOTIFIED', 'x', 'system', 'SalonSaaS[Account Salon] Your order has shipped', 'full body', now())", paid, salonId);
        order(salonId, "ann@example.com", "FAILED", "SO-1002"); // abandoned checkout

        long plan = jdbc.queryForObject("INSERT INTO membership_plan (salon_id, name, price, currency, billing_interval, status) " +
                "VALUES (?, 'Glow', 49, 'EUR', 'MONTHLY', 'ACTIVE') RETURNING id", Long.class, salonId);
        long active = membership(salonId, plan, "ann@example.com", "ACTIVE");
        jdbc.update("INSERT INTO membership_payment (subscription_id, salon_id, kind, status, amount, currency, paid_at) " +
                "VALUES (?, ?, 'SIGNUP', 'PAID', 49, 'EUR', now())", active, salonId);
        membership(salonId, plan, "ann@example.com", "INCOMPLETE");
    }

    @Test
    void customerSignsInWithAnEmailedCodeAndSeesOnlyTheirOwnHistory() {
        // An unknown address gets the same answer as a known one — and no email.
        signIn(salonId, "nobody@example.com").expectStatus().isAccepted();
        assertThat(codesSentTo("nobody@example.com")).isEmpty();
        // Ann has history in this salon only, so the other salon sends her nothing.
        signIn(otherSalonId, "ann@example.com").expectStatus().isAccepted();
        assertThat(codesSentTo("ann@example.com")).isEmpty();

        signIn(salonId, "  ANN@example.com ").expectStatus().isAccepted().expectBody()
                .jsonPath("$.codeLength").isEqualTo(6)
                .jsonPath("$.expiresInSeconds").isEqualTo(600);
        var code = lastCode("ann@example.com");

        verify(salonId, "ann@example.com", wrong(code)).expectStatus().isUnauthorized();
        var token = token(verify(salonId, "Ann@Example.com", code).expectStatus().isOk());
        // Single use.
        verify(salonId, "ann@example.com", code).expectStatus().isUnauthorized();

        var account = account(salonId, token);
        assertThat(JsonPath.<String>read(account, "$.profile.email")).isEqualTo("ann@example.com");
        assertThat(JsonPath.<List<Object>>read(account, "$.bookings")).hasSize(1);
        assertThat(JsonPath.<String>read(account, "$.bookings[0].serviceName")).isEqualTo("Haircut");
        assertThat(JsonPath.<String>read(account, "$.bookings[0].staffName")).isEqualTo("Sam Stylist");

        assertThat(JsonPath.<List<String>>read(account, "$.orders[*].orderNumber")).containsExactly("SO-1001");
        assertThat(JsonPath.<List<String>>read(account, "$.orders[0].timeline[*].type")).containsExactly("ORDER_PLACED", "CUSTOMER_NOTIFIED");
        assertThat(JsonPath.<List<String>>read(account, "$.orders[0].timeline[*].message")).contains("Your order has shipped");
        assertThat(account).as("email subject prefix is stripped").doesNotContain("SalonSaaS[");
        assertThat(account).doesNotContain("customer is difficult").doesNotContain("full body").doesNotContain("paymentReference");

        assertThat(JsonPath.<List<String>>read(account, "$.memberships[*].status")).containsExactly("ACTIVE");
        assertThat(JsonPath.<String>read(account, "$.memberships[0].qrCode")).startsWith("data:image/png;base64,");
        assertThat(JsonPath.<String>read(account, "$.memberships[0].renewalToken")).isNotBlank();
        assertThat(JsonPath.<List<String>>read(account, "$.memberships[0].payments[*].status")).containsExactly("PAID");

        // The session is good for this salon only, and only with the token.
        client.get().uri("/api/salon/{id}/account", otherSalonId).header(SESSION, token).exchange().expectStatus().isUnauthorized();
        client.get().uri("/api/salon/{id}/account", salonId).exchange().expectStatus().isUnauthorized();

        client.post().uri("/api/salon/{id}/account/sign-out", salonId).header(SESSION, token).exchange().expectStatus().isNoContent();
        client.get().uri("/api/salon/{id}/account", salonId).header(SESSION, token).exchange().expectStatus().isUnauthorized();
    }

    @Test
    void aCodeStopsWorkingAfterTooManyWrongGuesses() {
        signIn(salonId, "ann@example.com").expectStatus().isAccepted();
        var code = lastCode("ann@example.com");
        for (int i = 0; i < 5; i++) verify(salonId, "ann@example.com", wrong(code)).expectStatus().isUnauthorized();
        verify(salonId, "ann@example.com", code).expectStatus().isUnauthorized();
    }

    @Test
    void codesToOneAddressAreCappedWithoutTellingTheCaller() {
        for (int i = 0; i < 7; i++) signIn(salonId, "bob@example.com").expectStatus().isAccepted();
        assertThat(codesSentTo("bob@example.com")).hasSize(5);
        // Only the latest code works.
        var codes = codesSentTo("bob@example.com");
        verify(salonId, "bob@example.com", codes.getFirst()).expectStatus().isUnauthorized();
        verify(salonId, "bob@example.com", codes.getLast()).expectStatus().isOk();
    }

    @Test
    void oneClientIpIsRateLimited() {
        for (int i = 0; i < 30; i++) signIn(salonId, "visitor" + i + "@example.com").expectStatus().isAccepted();
        signIn(salonId, "visitor-last@example.com").expectStatus().isEqualTo(429);
    }

    @Test
    void anInvalidEmailIsABadRequest() {
        signIn(salonId, "not-an-email").expectStatus().isBadRequest();
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private RestTestClient.ResponseSpec signIn(UUID salon, String email) {
        return client.post().uri("/api/salon/{id}/account/sign-in", salon)
                .header("X-Forwarded-For", clientIp)
                .contentType(MediaType.APPLICATION_JSON).body("{\"email\":\"" + email + "\"}").exchange();
    }

    private RestTestClient.ResponseSpec verify(UUID salon, String email, String code) {
        return client.post().uri("/api/salon/{id}/account/verify", salon)
                .contentType(MediaType.APPLICATION_JSON)
                .body("{\"email\":\"" + email + "\",\"code\":\"" + code + "\"}").exchange();
    }

    private String account(UUID salon, String token) {
        var body = client.get().uri("/api/salon/{id}/account", salon).header(SESSION, token).exchange()
                .expectStatus().isOk().expectBody().returnResult().getResponseBody();
        return new String(body, StandardCharsets.UTF_8);
    }

    private static String token(RestTestClient.ResponseSpec response) {
        var body = response.expectBody().returnResult().getResponseBody();
        return JsonPath.read(new String(body, StandardCharsets.UTF_8), "$.sessionToken");
    }

    private List<String> codesSentTo(String email) {
        return events.stream(CustomerSignInCodeRequestedEvent.class)
                .filter(e -> e.email().equals(email) && e.salonId().equals(salonId))
                .map(CustomerSignInCodeRequestedEvent::code)
                .toList();
    }

    private String lastCode(String email) {
        var codes = codesSentTo(email);
        assertThat(codes).isNotEmpty();
        return codes.getLast();
    }

    private static String wrong(String code) {
        return code.equals("000000") ? "000001" : "000000";
    }

    private UUID salon(String name) {
        var id = UUID.randomUUID();
        jdbc.update("INSERT INTO salon (id, name, handler, owner_name, owner_email, contact_email, contact_phone, created_at) " +
                        "VALUES (?, ?, ?, 'Owner', 'owner@account.test', 'salon@account.test', '+100000000', now())",
                id, name, "acct-" + id.toString().substring(0, 8));
        return id;
    }

    private void booking(UUID salon, long service, long staff, String email, LocalDate date) {
        jdbc.update("INSERT INTO booking (salon_id, service_id, staff_id, customer_name, customer_email, appointment_date, start_time, end_time, status, created_at) " +
                "VALUES (?, ?, ?, 'Ann Customer', ?, ?, '10:00', '11:00', 'CONFIRMED', now())", salon, service, staff, email, date);
    }

    private long order(UUID salon, String email, String paymentStatus, String number) {
        long id = jdbc.queryForObject("INSERT INTO shop_order (salon_id, order_number, customer_name, customer_email, status, payment_status, " +
                "payment_reference, subtotal, currency, created_at) VALUES (?, ?, 'Ann Customer', ?, 'NEW', ?, 'cs_secret_ref', 25, 'EUR', now()) RETURNING id",
                Long.class, salon, number, email, paymentStatus);
        jdbc.update("INSERT INTO shop_order_line (order_id, order_key, product_name, variant_label, unit_price, quantity, line_total) " +
                "VALUES (?, 0, 'Shampoo', '250 ml', 12.5, 2, 25)", id);
        return id;
    }

    private long membership(UUID salon, long plan, String email, String status) {
        var suffix = UUID.randomUUID().toString().replace("-", "");
        return jdbc.queryForObject("INSERT INTO membership_subscription (salon_id, plan_id, plan_name, member_code, renewal_token, customer_name, " +
                        "customer_email, status, price, currency, billing_interval, started_at, current_period_end) " +
                        "VALUES (?, ?, 'Glow', ?, ?, 'Ann Customer', ?, ?, 49, 'EUR', 'MONTHLY', now(), ?) RETURNING id",
                Long.class, salon, plan, suffix.substring(0, 10).toUpperCase(), suffix, email, status,
                Timestamp.from(Instant.now().plus(30, ChronoUnit.DAYS)));
    }
}
