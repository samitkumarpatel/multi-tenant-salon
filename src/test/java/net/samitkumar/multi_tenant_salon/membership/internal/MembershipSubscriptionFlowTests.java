package net.samitkumar.multi_tenant_salon.membership.internal;

import com.jayway.jsonpath.JsonPath;
import net.samitkumar.multi_tenant_salon.MultiTenantSalonApplication;
import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import net.samitkumar.multi_tenant_salon.payments.CheckoutUi;
import net.samitkumar.multi_tenant_salon.payments.PaymentGateway;
import net.samitkumar.multi_tenant_salon.payments.StripePaymentEvent;
import net.samitkumar.multi_tenant_salon.payments.internal.StripeConnectService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The paid membership lifecycle end to end, paid the way the shop and till are: sign-up → one-time
 * Stripe Checkout (mocked gateway) → {@code StripePaymentEvent} → active member with the QR email on
 * the timeline → renewal link → expiry → salon cancellation. Full context, since it spans the
 * membership, payments and notification modules.
 */
@SpringBootTest(classes = MultiTenantSalonApplication.class)
@Import(TestcontainersConfiguration.class)
class MembershipSubscriptionFlowTests {

    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired ApplicationEventPublisher events;
    @Autowired MembershipManager memberships;
    @Autowired PlatformTransactionManager transactionManager;
    @MockitoBean StripeConnectService stripe;

    RestTestClient client;
    UUID salonId;
    long planId;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
        salonId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO salon (id, name, handler, owner_name, owner_email, contact_email, contact_phone, created_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, now())",
                salonId, "Flow Salon", "flow-" + salonId.toString().substring(0, 8),
                "Owner", "owner@flow.test", "salon@flow.test", "+100000000");
        jdbcTemplate.update("INSERT INTO salon_feature (salon_id, feature) VALUES (?, 'MEMBERSHIP')", salonId);
        planId = json(client.post().uri(adminBase() + "/plans").contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "name": "Glow Monthly", "price": 49.00, "currency": "EUR", "billingInterval": "MONTHLY",
                          "signupFee": 10, "maxMembers": 1, "status": "ACTIVE", "perks": ["Priority booking"] }""")
                .exchange().expectStatus().isCreated().expectBody().returnResult().getResponseBody(), "$.id");
        when(stripe.enabled(salonId, "MEMBERSHIP")).thenReturn(true);
        when(stripe.createCheckout(eq(salonId), any())).thenReturn(new PaymentGateway.Checkout(CheckoutUi.REDIRECT,
                "https://checkout.stripe.test/session", null, null, null, null, null, null));
    }

    private String adminBase() { return "/api/salon-admin/" + salonId + "/membership"; }
    private String publicBase() { return "/api/salon/" + salonId + "/membership"; }

    @Test
    void memberSignsUpRenewsLapsesAndIsCancelledByTheSalon() {
        client.get().uri(publicBase() + "/plans").exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.onlineSignup").isEqualTo(true)
                .jsonPath("$.plans[0].spotsLeft").isEqualTo(1);

        long subId = checkout("Ann Member", "ann@example.com");
        var signup = latestPayment(subId);
        // The first charge is one period plus the sign-up fee, through the same one-time checkout the shop uses.
        assertThat(signup.get("kind")).isEqualTo("SIGNUP");
        assertThat(new BigDecimal(signup.get("amount").toString())).isEqualByComparingTo("59.00");
        verify(stripe).createCheckout(eq(salonId), argThat(r -> r.area().equals("MEMBERSHIP")
                && r.reference().equals(String.valueOf(signup.get("id"))) && r.amount().compareTo(new BigDecimal("59.00")) == 0
                && r.currency().equals("EUR") && r.itemName().equals("Glow Monthly membership — Flow Salon")
                && r.customerEmail().equals("ann@example.com")));

        // The unpaid checkout holds the plan's only place.
        client.post().uri(publicBase() + "/checkout").contentType(MediaType.APPLICATION_JSON)
                .body(checkoutBody("Bo", "bo@example.com")).exchange().expectStatus().isEqualTo(409);

        pay(signup, true);
        pay(signup, true); // Stripe redelivery
        var detail = detail(subId);
        assertThat(JsonPath.<String>read(detail, "$.subscription.status")).isEqualTo("ACTIVE");
        assertThat(JsonPath.<String>read(detail, "$.subscription.lastPaymentStatus")).isEqualTo("PAID");
        assertThat(JsonPath.<List<String>>read(detail, "$.payments[*].status")).containsExactly("PAID");
        assertThat(JsonPath.<List<String>>read(detail, "$.activity[?(@.type == 'ACTIVATED')]")).hasSize(1);
        var firstEnd = Instant.parse(JsonPath.read(detail, "$.subscription.currentPeriodEnd"));
        assertThat(firstEnd).isCloseTo(Instant.now().atOffset(ZoneOffset.UTC).plusMonths(1).toInstant(), within());
        String code = JsonPath.read(detail, "$.subscription.memberCode");
        String token = JsonPath.read(detail, "$.subscription.renewalToken");

        assertThat(awaitEmail(subId, "Welcome!")).contains("ann@example.com");

        // Desk check-in: a scanned or typed code (any case, with separators) finds the member.
        client.get().uri(adminBase() + "/verify?code=" + code.toLowerCase().substring(0, 3) + "-" + code.toLowerCase().substring(3))
                .exchange().expectStatus().isOk().expectBody().jsonPath("$.subscription.id").isEqualTo(subId);
        var png = client.get().uri(adminBase() + "/subscriptions/" + subId + "/qr.png").exchange()
                .expectStatus().isOk().expectHeader().contentType(MediaType.IMAGE_PNG)
                .expectBody().returnResult().getResponseBody();
        assertThat(png).startsWith(0x89, 'P', 'N', 'G');

        client.get().uri(adminBase() + "/overview").exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.activeMembers").isEqualTo(1)
                .jsonPath("$.monthlyRecurringRevenue[0].amount").isEqualTo(49.0)
                .jsonPath("$.collectedThisMonth[0].amount").isEqualTo(59.0);

        // A week before the end the member is emailed a renewal link — once, however often the job runs.
        memberships.processRenewals(firstEnd.minus(6, ChronoUnit.DAYS));
        memberships.processRenewals(firstEnd.minus(5, ChronoUnit.DAYS));
        assertThat(awaitEmail(subId, "Time to renew")).contains("ann@example.com");
        assertThat(JsonPath.<List<?>>read(detail(subId), "$.activity[?(@.message =~ /.*Time to renew.*/)]")).hasSize(1);

        // Renewing early extends from the current end; a failed attempt changes nothing.
        client.get().uri(publicBase() + "/renewals/" + token).exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.firstName").isEqualTo("Ann").jsonPath("$.canRenewNow").isEqualTo(true)
                .jsonPath("$.price").isEqualTo(49.0);
        renew(token);
        pay(latestPayment(subId), false);
        assertThat(JsonPath.<String>read(detail(subId), "$.subscription.status")).isEqualTo("ACTIVE");
        renew(token);
        var renewal = latestPayment(subId);
        assertThat(renewal.get("kind")).isEqualTo("RENEWAL");
        assertThat(new BigDecimal(renewal.get("amount").toString())).isEqualByComparingTo("49.00");
        pay(renewal, true);
        var secondEnd = Instant.parse(JsonPath.read(detail(subId), "$.subscription.currentPeriodEnd"));
        assertThat(secondEnd).isEqualTo(firstEnd.atOffset(ZoneOffset.UTC).plusMonths(1).toInstant());
        awaitEmail(subId, "Membership renewed");

        // Not renewed again: the period runs out, the member expires and gets a "renew" email.
        memberships.processRenewals(secondEnd.plusSeconds(60));
        assertThat(JsonPath.<String>read(detail(subId), "$.subscription.status")).isEqualTo("EXPIRED");
        awaitEmail(subId, "has ended");
        client.get().uri(adminBase() + "/verify?code=" + code).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.subscription.status").isEqualTo("EXPIRED");

        // Renewing after a lapse starts a fresh period now.
        renew(token);
        pay(latestPayment(subId), true);
        var detailAfterLapse = detail(subId);
        assertThat(JsonPath.<String>read(detailAfterLapse, "$.subscription.status")).isEqualTo("ACTIVE");
        assertThat(Instant.parse(JsonPath.read(detailAfterLapse, "$.subscription.currentPeriodEnd")))
                .isCloseTo(Instant.now().atOffset(ZoneOffset.UTC).plusMonths(1).toInstant(), within());

        // The salon cancels at period end: no reminder, and the membership ends when the period does.
        client.post().uri(adminBase() + "/subscriptions/" + subId + "/cancel").contentType(MediaType.APPLICATION_JSON)
                .body("{ \"atPeriodEnd\": true, \"reason\": \"Moving away\" }")
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.subscription.cancelAtPeriodEnd").isEqualTo(true)
                .jsonPath("$.subscription.status").isEqualTo("ACTIVE");
        awaitEmail(subId, "Membership cancelled");
        client.post().uri(adminBase() + "/subscriptions/" + subId + "/resume").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.subscription.cancelAtPeriodEnd").isEqualTo(false);
        client.post().uri(adminBase() + "/subscriptions/" + subId + "/cancel").contentType(MediaType.APPLICATION_JSON)
                .body("{ \"atPeriodEnd\": true }").exchange().expectStatus().isOk();
        var thirdEnd = Instant.parse(JsonPath.read(detail(subId), "$.subscription.currentPeriodEnd"));
        memberships.processRenewals(thirdEnd.minus(3, ChronoUnit.DAYS));
        memberships.processRenewals(thirdEnd.plusSeconds(60));
        var ended = detail(subId);
        assertThat(JsonPath.<String>read(ended, "$.subscription.status")).isEqualTo("CANCELLED");
        assertThat(JsonPath.<List<?>>read(ended, "$.activity[?(@.message =~ /.*Time to renew.*/)]")).hasSize(1);
        client.post().uri(publicBase() + "/renewals/" + token + "/checkout").exchange().expectStatus().isEqualTo(409);

        // The place is free again, and the member list filters by status.
        checkout("Bo", "bo@example.com");
        client.get().uri(adminBase() + "/subscriptions?status=CANCELLED").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.length()").isEqualTo(1).jsonPath("$[0].customerName").isEqualTo("Ann Member");
    }

    @Test
    void abandonedCheckoutBecomesIncompleteAndFreesThePlace() {
        long subId = checkout("Ann", "ann@example.com");
        pay(latestPayment(subId), false);
        assertThat(JsonPath.<String>read(detail(subId), "$.subscription.status")).isEqualTo("INCOMPLETE");
        client.post().uri(adminBase() + "/subscriptions/" + subId + "/cancel").exchange().expectStatus().isEqualTo(409);
        checkout("Bo", "bo@example.com");
    }

    @Test
    void stripeRefusingTheCheckoutLeavesNoPendingMembership() {
        when(stripe.createCheckout(eq(salonId), any()))
                .thenThrow(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Stripe request failed"));

        client.post().uri(publicBase() + "/checkout").contentType(MediaType.APPLICATION_JSON)
                .body(checkoutBody("Ann", "ann@example.com")).exchange().expectStatus().isEqualTo(502);

        var subs = jdbcTemplate.queryForList("SELECT status FROM membership_subscription WHERE salon_id = ?", String.class, salonId);
        assertThat(subs).containsExactly("INCOMPLETE");
        assertThat(jdbcTemplate.queryForList("SELECT status FROM membership_payment WHERE salon_id = ?", String.class, salonId))
                .containsExactly("FAILED");
    }

    @Test
    void cancellingImmediatelyEndsTheMembershipNow() {
        long subId = checkout("Ann", "ann@example.com");
        pay(latestPayment(subId), true);
        client.post().uri(adminBase() + "/subscriptions/" + subId + "/cancel").contentType(MediaType.APPLICATION_JSON)
                .body("{ \"atPeriodEnd\": false }").exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.subscription.status").isEqualTo("CANCELLED");
        client.post().uri(adminBase() + "/subscriptions/" + subId + "/send-renewal-link").exchange().expectStatus().isEqualTo(409);
    }

    @Test
    void cashSaleAtTheDeskActivatesAtOnceAndSendsTheQrEmail() {
        var body = client.post().uri(adminBase() + "/desk-sales").contentType(MediaType.APPLICATION_JSON)
                .body(deskSaleBody("Walk In", "walkin@example.com", "CASH"))
                .exchange().expectStatus().isCreated().expectBody()
                .jsonPath("$.checkoutUrl").doesNotExist()
                .returnResult().getResponseBody();
        long subId = json(body, "$.subscriptionId");

        var detail = detail(subId);
        assertThat(JsonPath.<String>read(detail, "$.subscription.status")).isEqualTo("ACTIVE");
        assertThat(JsonPath.<String>read(detail, "$.subscription.source")).isEqualTo("ADMIN");
        assertThat(JsonPath.<String>read(detail, "$.payments[0].status")).isEqualTo("PAID");
        assertThat(JsonPath.<String>read(detail, "$.payments[0].method")).isEqualTo("CASH");
        assertThat(new BigDecimal(JsonPath.read(detail, "$.payments[0].amount").toString())).isEqualByComparingTo("59.00");
        assertThat(JsonPath.<List<String>>read(detail, "$.activity[?(@.type == 'ACTIVATED')].message"))
                .singleElement().asString().contains("in cash at the desk");
        assertThat(awaitEmail(subId, "Welcome!")).contains("walkin@example.com");
        verify(stripe, org.mockito.Mockito.never()).createCheckout(eq(salonId), any());

        // The desk sale takes the capped plan's only place, like an online sign-up.
        client.post().uri(adminBase() + "/desk-sales").contentType(MediaType.APPLICATION_JSON)
                .body(deskSaleBody("Bo", "bo@example.com", "OTHER")).exchange().expectStatus().isEqualTo(409);
    }

    @Test
    void cardSaleAtTheDeskWaitsForStripeLikeOnlineSignUp() {
        var desk = "https://dashboard.salonsaas.org/" + salonId + "?view=membership&membershipView=sell";
        var body = client.post().uri(adminBase() + "/desk-sales").contentType(MediaType.APPLICATION_JSON)
                .body(deskSaleBody("Card Customer", "card@example.com", "CARD").replace("}", ", \"returnUrl\": \"" + desk + "\" }"))
                .exchange().expectStatus().isCreated().expectBody()
                .jsonPath("$.checkoutUrl").isEqualTo("https://checkout.stripe.test/session")
                .returnResult().getResponseBody();
        long subId = json(body, "$.subscriptionId");
        var payment = latestPayment(subId);
        assertThat(payment.get("method")).isEqualTo("CARD");
        assertThat(JsonPath.<String>read(detail(subId), "$.subscription.status")).isEqualTo("PENDING_PAYMENT");
        verify(stripe).createCheckout(eq(salonId), argThat(r -> r.area().equals("MEMBERSHIP")
                && r.reference().equals(String.valueOf(payment.get("id"))) && r.amount().compareTo(new BigDecimal("59.00")) == 0
                && r.currency().equals("EUR") && desk.equals(r.returnUrl()) && !r.inlineCheckout()));

        pay(payment, true);
        assertThat(JsonPath.<String>read(detail(subId), "$.subscription.status")).isEqualTo("ACTIVE");
    }

    @Test
    void cardReaderSaleAtTheDeskSettlesFromTheReaderOutcome() {
        when(stripe.collectOnTerminal(eq(salonId), eq("MEMBERSHIP"), anyString(), any(), eq("EUR"), any(), eq(5L)))
                .thenAnswer(call -> new PaymentGateway.TerminalPayment(900L, "PENDING", 5L, "Front desk",
                        call.getArgument(3), "EUR", null));
        var body = client.post().uri(adminBase() + "/desk-sales").contentType(MediaType.APPLICATION_JSON)
                .body(deskSaleBody("Reader Customer", "reader@example.com", "CARD").replace("}", ", \"terminalId\": 5 }"))
                .exchange().expectStatus().isCreated().expectBody()
                .jsonPath("$.checkoutUrl").doesNotExist()
                .jsonPath("$.terminalPayment.terminalLabel").isEqualTo("Front desk")
                .jsonPath("$.terminalPayment.status").isEqualTo("PENDING")
                .returnResult().getResponseBody();
        long subId = json(body, "$.subscriptionId");
        var payment = latestPayment(subId);
        verify(stripe).collectOnTerminal(eq(salonId), eq("MEMBERSHIP"), eq(String.valueOf(payment.get("id"))),
                argThat(amount -> amount.compareTo(new BigDecimal("59.00")) == 0), eq("EUR"), any(), eq(5L));
        verify(stripe, org.mockito.Mockito.never()).createCheckout(eq(salonId), any());
        assertThat(JsonPath.<String>read(detail(subId), "$.subscription.status")).isEqualTo("PENDING_PAYMENT");

        pay(payment, true);
        assertThat(JsonPath.<String>read(detail(subId), "$.subscription.status")).isEqualTo("ACTIVE");
    }

    @Test
    void deskCardSaleNeedsOnlinePaymentButCashDoesNot() {
        when(stripe.enabled(salonId, "MEMBERSHIP")).thenReturn(false);
        client.post().uri(adminBase() + "/desk-sales").contentType(MediaType.APPLICATION_JSON)
                .body(deskSaleBody("Ann", "ann@example.com", "CARD")).exchange().expectStatus().isEqualTo(409);
        client.post().uri(adminBase() + "/desk-sales").contentType(MediaType.APPLICATION_JSON)
                .body(deskSaleBody("Ann", "ann@example.com", "CASH")).exchange().expectStatus().isCreated();
        client.post().uri(adminBase() + "/desk-sales").contentType(MediaType.APPLICATION_JSON)
                .body("{ \"planId\": %d, \"customerName\": \"Ann\", \"customerEmail\": \"ann@example.com\" }".formatted(planId))
                .exchange().expectStatus().isBadRequest();
    }

    @Test
    void sameEmailCantJoinTheSamePlanTwice() {
        jdbcTemplate.update("UPDATE membership_plan SET max_members = NULL WHERE id = ?", planId);
        long subId = checkout("Ann", "ann@example.com");
        pay(latestPayment(subId), true);
        client.post().uri(publicBase() + "/checkout").contentType(MediaType.APPLICATION_JSON)
                .body(checkoutBody("Ann", "ANN@example.com")).exchange().expectStatus().isEqualTo(409);
    }

    private long checkout(String name, String email) {
        var body = client.post().uri(publicBase() + "/checkout").contentType(MediaType.APPLICATION_JSON)
                .body(checkoutBody(name, email))
                .exchange().expectStatus().isCreated().expectBody()
                .jsonPath("$.checkoutUrl").isEqualTo("https://checkout.stripe.test/session")
                .returnResult().getResponseBody();
        return json(body, "$.subscriptionId");
    }

    private void renew(String token) {
        client.post().uri(publicBase() + "/renewals/" + token + "/checkout").contentType(MediaType.APPLICATION_JSON)
                .body("{}").exchange().expectStatus().isCreated()
                .expectBody().jsonPath("$.checkoutUrl").isEqualTo("https://checkout.stripe.test/session");
    }

    private String checkoutBody(String name, String email) {
        return "{ \"planId\": %d, \"customerName\": \"%s\", \"customerEmail\": \"%s\" }".formatted(planId, name, email);
    }

    private String deskSaleBody(String name, String email, String method) {
        return "{ \"planId\": %d, \"customerName\": \"%s\", \"customerEmail\": \"%s\", \"paymentMethod\": \"%s\" }"
                .formatted(planId, name, email, method);
    }

    /**
     * What the Connect webhook publishes for the checkout of {@code payment} — exactly as for a shop
     * order: inside a transaction, so Spring Modulith stores it, then delivered asynchronously. Waits
     * until the membership module has handled it (delivered publications leave {@code event_publication}).
     */
    private void pay(Map<String, Object> payment, boolean succeeded) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status ->
                events.publishEvent(new StripePaymentEvent(salonId, "MEMBERSHIP", String.valueOf(payment.get("id")),
                        "cs_" + payment.get("id"), succeeded)));
        await().atMost(Duration.ofSeconds(15)).until(() -> jdbcTemplate.queryForObject(
                "SELECT count(*) FROM event_publication WHERE event_type = ?", Integer.class,
                StripePaymentEvent.class.getName()) == 0);
    }

    private Map<String, Object> latestPayment(long subId) {
        return JsonPath.read(detail(subId), "$.payments[0]");
    }

    private String detail(long subId) {
        return new String(client.get().uri(adminBase() + "/subscriptions/" + subId).exchange()
                .expectStatus().isOk().expectBody().returnResult().getResponseBody(), StandardCharsets.UTF_8);
    }

    /** Waits for the notification round-trip to land a CUSTOMER_NOTIFIED entry whose message contains {@code text}. */
    private String awaitEmail(long subId, String text) {
        return await().atMost(Duration.ofSeconds(15)).until(() -> {
            List<Map<String, Object>> rows = JsonPath.read(detail(subId), "$.activity[?(@.type == 'CUSTOMER_NOTIFIED')]");
            return rows.stream().map(r -> (String) r.get("message")).filter(m -> m.contains(text)).findFirst().orElse(null);
        }, m -> m != null);
    }

    private static org.assertj.core.data.TemporalUnitOffset within() {
        return org.assertj.core.api.Assertions.within(5, ChronoUnit.MINUTES);
    }

    private static long json(byte[] body, String path) {
        return ((Number) JsonPath.read(new String(body, StandardCharsets.UTF_8), path)).longValue();
    }
}
