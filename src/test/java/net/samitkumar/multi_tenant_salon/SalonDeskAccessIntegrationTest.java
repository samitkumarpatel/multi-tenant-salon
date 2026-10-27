package net.samitkumar.multi_tenant_salon;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.client.RestTestClient;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Salon staff (stylists, receptionists, managers) can work the desk of the salon they belong to —
 * and only its desk endpoints — while everything else under the owner API stays owner-only.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.flyway.enabled=true", "spring.sql.init.mode=never",
        // This class is the one place that exercises the real security chain, so it overrides the
        // blanket permit-all the other tests run with.
        "app.security.permit-all=false",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://auth.test"
})
@Import(TestcontainersConfiguration.class)
class SalonDeskAccessIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @MockitoBean JwtDecoder decoder;
    @Value("${local.server.port}") int port;
    RestTestClient client;
    UUID salonId;
    UUID otherSalonId;
    String tag;
    final Map<String, String[]> tokens = new java.util.concurrent.ConcurrentHashMap<>();

    private String token(String role, UUID salon, String email) {
        var value = "tok-" + tokens.size();
        tokens.put(value, new String[] {role, salon.toString(), email});
        return "Bearer " + value;
    }

    @BeforeEach void setup() {
        tag = UUID.randomUUID().toString().substring(0, 8);
        salonId = salon("Desk salon", true);
        otherSalonId = salon("Other salon", true);
        staff(salonId, "stylist-" + tag + "@desk.test", "STYLIST", "ACTIVE");
        staff(salonId, "manager-" + tag + "@desk.test", "MANAGER", "ACTIVE");
        staff(salonId, "gone-" + tag + "@desk.test", "STYLIST", "INACTIVE");
        staff(otherSalonId, "elsewhere-" + tag + "@desk.test", "RECEPTIONIST", "ACTIVE");
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        // Opaque test tokens standing for the claims the auth server would issue for that person.
        when(decoder.decode(anyString())).thenAnswer(invocation -> {
            String[] parts = tokens.get((String) invocation.getArgument(0));
            return Jwt.withTokenValue(invocation.getArgument(0)).header("alg", "RS256").subject(parts[2])
                    .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300))
                    .claim("roles", List.of(parts[0]))
                    .claim("salons", List.of(Map.of("salonId", parts[1], "role", parts[0], "active", true))).build();
        });
    }

    private UUID salon(String name, boolean desk) {
        var id = UUID.randomUUID();
        jdbc.update("INSERT INTO salon (id, name, handler, owner_name, owner_email, created_at) VALUES (?, ?, ?, 'Owner', ?, now())",
                id, name, "desk-" + id, "owner-" + id + "@desk.test");
        jdbc.update("INSERT INTO salon_feature (salon_id, feature) VALUES (?, 'BOOKING')", id);
        jdbc.update("INSERT INTO salon_feature (salon_id, feature) VALUES (?, 'MEMBERSHIP')", id);
        if (desk) jdbc.update("INSERT INTO salon_feature (salon_id, feature) VALUES (?, 'DASHBOARD')", id);
        return id;
    }

    private void staff(UUID salon, String email, String role, String status) {
        jdbc.update("INSERT INTO staff_member (salon_id, name, email, role, status, created_at) VALUES (?, ?, ?, ?, ?, now())",
                salon, email, email, role, status);
    }

    private String staffToken(UUID salon, String who) { return token("STAFF", salon, who + "-" + tag + "@desk.test"); }

    private RestTestClient.ResponseSpec get(String path, String token) {
        return client.get().uri("/api/salon-admin/" + salonId + path).header("Authorization", token).exchange();
    }

    @Test void staffOfTheSalonCanUseTheDeskButNotTheRestOfTheOwnerApi() {
        for (var who : List.of("stylist", "manager")) {
            var token = staffToken(salonId, who);
            get("", token).expectStatus().isOk();
            get("/booking", token).expectStatus().isOk();
            get("/staff", token).expectStatus().isOk();
            get("/membership/plans", token).expectStatus().isOk();
            // Passes security; there is simply no member with that code.
            get("/membership/verify?code=NOPE", token).expectStatus().isNotFound();
            // Card readers: the desk picks one and follows the payment on it.
            get("/payments/terminals", token).expectStatus().isOk();
            get("/payments/terminal-payments/999999", token).expectStatus().isNotFound();
            client.post().uri("/api/salon-admin/" + salonId + "/payments/terminal-payments/999999/cancel")
                    .header("Authorization", token).exchange().expectStatus().isNotFound();

            // Owner-only: salon settings, staff management, membership admin.
            client.put().uri("/api/salon-admin/" + salonId).header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON).body("{\"name\":\"Hijacked\"}").exchange().expectStatus().isForbidden();
            client.post().uri("/api/salon-admin/" + salonId + "/staff").header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
            client.delete().uri("/api/salon-admin/" + salonId + "/booking/1").header("Authorization", token)
                    .exchange().expectStatus().isForbidden();
            get("/membership/overview", token).expectStatus().isForbidden();
            get("/membership/subscriptions", token).expectStatus().isForbidden();
            // Registering readers, payment settings, transactions and refunds stay with the owner.
            client.post().uri("/api/salon-admin/" + salonId + "/payments/terminals").header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
            get("/payments/transactions", token).expectStatus().isForbidden();
            client.post().uri("/api/salon-admin/" + salonId + "/payments/transactions/1/refunds").header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
            client.post().uri("/api/salon-admin/" + salonId + "/payments/stripe/account-session").header("Authorization", token)
                    .exchange().expectStatus().isForbidden();
            client.put().uri("/api/salon-admin/" + salonId + "/dashboard/settings").header("Authorization", token)
                    .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
        }
    }

    @Test void staffOfAnotherSalonAreRefusedEvenWithAForgedClaim() {
        // Their real token names their own salon.
        get("/booking", staffToken(otherSalonId, "elsewhere")).expectStatus().isForbidden();
        // A token claiming this salon doesn't help: the database says they don't work here.
        get("/booking", staffToken(salonId, "elsewhere")).expectStatus().isForbidden();
    }

    @Test void deactivatedOrRemovedStaffAreLockedOutStraightAway() {
        // The token still says active staff, but the database no longer does.
        get("/booking", staffToken(salonId, "gone")).expectStatus().isForbidden();
        var token = staffToken(salonId, "stylist");
        get("/booking", token).expectStatus().isOk();
        jdbc.update("UPDATE staff_member SET status = 'INACTIVE' WHERE email = ?", "stylist-" + tag + "@desk.test");
        get("/booking", token).expectStatus().isForbidden();
    }

    @Test void staffCantUseTheDeskOfASalonWithoutTheDeskFeature() {
        jdbc.update("DELETE FROM salon_feature WHERE salon_id = ? AND feature = 'DASHBOARD'", salonId);
        get("/booking", staffToken(salonId, "stylist")).expectStatus().isForbidden();
    }

    @Test void theOwnerKeepsFullAccess() {
        var owner = token("OWNER", salonId, "owner-" + salonId + "@desk.test");
        get("/membership/overview", owner).expectStatus().isOk();
        get("/membership/subscriptions", owner).expectStatus().isOk();
    }

    /**
     * Every allowlisted endpoint, asserted to actually let desk staff through. A typo in a rule would
     * otherwise ship as a production 403 that no test notices — the UI simply stops working at the
     * counter. Only the security decision is under test, so any non-403 answer counts as a pass.
     */
    @Test void everyAllowlistedDeskEndpointIsReachableByStaff() {
        var token = staffToken(salonId, "stylist");
        record Call(String method, String path) {}
        var calls = List.of(
                new Call("GET", ""),
                new Call("GET", "/dashboard/settings"),
                new Call("GET", "/dashboard/cashier/items"),
                new Call("GET", "/dashboard/sales"),
                new Call("GET", "/dashboard/reports/daily"),
                new Call("POST", "/dashboard/sales"),
                new Call("POST", "/dashboard/sales/card-checkout"),
                new Call("POST", "/dashboard/sales/terminal-checkout"),
                new Call("POST", "/dashboard/sales/999999/void"),
                new Call("GET", "/payments/stripe"),
                new Call("GET", "/payments/terminals"),
                new Call("GET", "/payments/terminal-payments/999999"),
                new Call("POST", "/payments/terminal-payments/999999/cancel"),
                new Call("POST", "/payments/terminal-payments/999999/retry"),
                new Call("GET", "/booking"),
                new Call("GET", "/booking/slots"),
                new Call("GET", "/booking/999999"),
                new Call("POST", "/booking"),
                new Call("PUT", "/booking/999999"),
                new Call("PUT", "/staff/999999/calendar-color"),
                new Call("POST", "/booking/999999/confirm"),
                new Call("POST", "/booking/999999/cancel"),
                new Call("POST", "/booking/999999/complete"),
                new Call("POST", "/booking/999999/no-show"),
                new Call("POST", "/booking/999999/payment-link"),
                new Call("GET", "/availability"),
                new Call("GET", "/closures"),
                new Call("GET", "/holidays"),
                new Call("GET", "/services"),
                new Call("GET", "/staff"),
                new Call("GET", "/staff/999999/availability"),
                new Call("GET", "/staff/999999/availability/overrides"),
                new Call("GET", "/membership/plans"),
                new Call("GET", "/membership/verify?code=NOPE"),
                new Call("GET", "/membership/subscriptions/999999"),
                new Call("GET", "/membership/subscriptions/999999/qr.png"),
                new Call("POST", "/membership/subscriptions/999999/send-renewal-link"),
                new Call("POST", "/membership/desk-sales"),
                new Call("GET", "/loyalty"),
                new Call("GET", "/loyalty/members"),
                new Call("GET", "/loyalty/member?email=a@b.c"),
                new Call("GET", "/loyalty/redemptions"),
                new Call("GET", "/loyalty/redemptions/by-code/NOPE"),
                new Call("POST", "/loyalty/redemptions/999999/use"));

        for (var call : calls) {
            var uri = "/api/salon-admin/" + salonId + call.path();
            var spec = switch (call.method()) {
                case "POST" -> client.post().uri(uri).header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).body("{}").exchange();
                case "PUT" -> client.put().uri(uri).header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).body("{}").exchange();
                default -> client.get().uri(uri).header("Authorization", token).exchange();
            };
            spec.expectStatus().value(status -> org.assertj.core.api.Assertions.assertThat(status)
                    .as("%s %s should not be refused by the desk allowlist", call.method(), call.path())
                    .isNotEqualTo(403));
        }
    }

    /** The owner-only endpoints most likely to be let in by a careless widening of a rule. */
    @Test void neighbouringEndpointsStayOwnerOnly() {
        var token = staffToken(salonId, "stylist");
        // Deliberately left out of the allowlist when it was added — this is its regression test.
        client.patch().uri("/api/salon-admin/" + salonId + "/membership/subscriptions/1/contact")
                .header("Authorization", token).contentType(MediaType.APPLICATION_JSON)
                .body("{\"customerName\":\"X\",\"customerEmail\":\"x@example.com\"}")
                .exchange().expectStatus().isForbidden();
        // A sub-path of an allowlisted single-segment rule must not inherit its permission.
        get("/membership/subscriptions/1/payments", token).expectStatus().isForbidden();
        // Same path, different method.
        client.delete().uri("/api/salon-admin/" + salonId + "/membership/subscriptions/1")
                .header("Authorization", token).exchange().expectStatus().isForbidden();
        client.post().uri("/api/salon-admin/" + salonId + "/membership/subscriptions/1/cancel")
                .header("Authorization", token).contentType(MediaType.APPLICATION_JSON).body("{}")
                .exchange().expectStatus().isForbidden();
        // Loyalty: the desk hands rewards over but cannot change the programme, mint points or void a code.
        client.put().uri("/api/salon-admin/" + salonId + "/loyalty/program").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
        client.post().uri("/api/salon-admin/" + salonId + "/loyalty/rewards").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
        client.post().uri("/api/salon-admin/" + salonId + "/loyalty/adjustments").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
        client.post().uri("/api/salon-admin/" + salonId + "/loyalty/redemptions/1/cancel").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
        // Refunding a membership payment is owner-only.
        client.post().uri("/api/salon-admin/" + salonId + "/membership/subscriptions/1/payments/1/refund")
                .header("Authorization", token).contentType(MediaType.APPLICATION_JSON).body("{}")
                .exchange().expectStatus().isForbidden();
    }

    @Test void turningOffAppointmentManagementClosesTheBookingEndpointsToTheDesk() {
        var token = staffToken(salonId, "stylist");
        get("/booking", token).expectStatus().isOk();

        jdbc.update("INSERT INTO dashboard_settings (salon_id, booking_management_enabled, cashier_enabled, updated_at) "
                + "VALUES (?, false, true, now()) ON CONFLICT (salon_id) DO UPDATE SET booking_management_enabled = false", salonId);

        // Hiding the tiles in the UI is not the control — the API itself refuses now.
        get("/booking", token).expectStatus().isForbidden();
        get("/booking/slots", token).expectStatus().isForbidden();
        client.post().uri("/api/salon-admin/" + salonId + "/booking/1/cancel").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
        get("/availability", token).expectStatus().isForbidden();

        // The till is a separate capability and keeps working.
        get("/dashboard/cashier/items", token).expectStatus().isOk();
        get("/services", token).expectStatus().isOk();

        // The owner is not subject to the desk's switches.
        get("/booking", token("OWNER", salonId, "owner-" + salonId + "@desk.test")).expectStatus().isOk();
    }

    @Test void turningOffTheCashierStopsTheDeskTakingMoney() {
        var token = staffToken(salonId, "stylist");
        jdbc.update("INSERT INTO dashboard_settings (salon_id, booking_management_enabled, cashier_enabled, updated_at) "
                + "VALUES (?, true, false, now()) ON CONFLICT (salon_id) DO UPDATE SET cashier_enabled = false", salonId);

        get("/dashboard/cashier/items", token).expectStatus().isForbidden();
        get("/dashboard/sales", token).expectStatus().isForbidden();
        client.post().uri("/api/salon-admin/" + salonId + "/dashboard/sales").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
        // Selling a membership at the counter is taking money at the counter.
        client.post().uri("/api/salon-admin/" + salonId + "/membership/desk-sales").header("Authorization", token)
                .contentType(MediaType.APPLICATION_JSON).body("{}").exchange().expectStatus().isForbidden();
        // Checking a member in is not.
        get("/membership/verify?code=NOPE", token).expectStatus().isNotFound();
    }

    /** Who rang a sale up is what settles "the drawer is £20 short" — and the literal "desk" never could. */
    @Test void aSaleIsAttributedToTheStaffMemberWhoRangItUpAndWhoVoidedIt() {
        var serviceId = jdbc.queryForObject("""
                INSERT INTO service_item (salon_id, name, price, currency, duration_minutes, category, active, created_at)
                VALUES (?, 'Beard Trim', 15.00, 'EUR', 15, 'HAIR', true, now()) RETURNING id""", Long.class, salonId);
        var stylist = staffToken(salonId, "stylist");
        var manager = staffToken(salonId, "manager");

        var created = client.post().uri("/api/salon-admin/" + salonId + "/dashboard/sales")
                .header("Authorization", stylist).contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "paymentMethod": "CASH",
                          "items": [ { "sourceType": "SERVICE", "sourceId": %d, "quantity": 1 } ] }""".formatted(serviceId))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.createdBy").isEqualTo("stylist-" + tag + "@desk.test")
                .returnResult().getResponseBody();
        long saleId = ((Number) com.jayway.jsonpath.JsonPath.read(
                new String(created, java.nio.charset.StandardCharsets.UTF_8), "$.id")).longValue();

        // A different person reversing it is recorded as them, not as whoever rang it up.
        client.post().uri("/api/salon-admin/" + salonId + "/dashboard/sales/" + saleId + "/void")
                .header("Authorization", manager).contentType(MediaType.APPLICATION_JSON).body("{}")
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.createdBy").isEqualTo("stylist-" + tag + "@desk.test")
                .jsonPath("$.voidedBy").isEqualTo("manager-" + tag + "@desk.test");
    }

    @Test void theDaySheetBreaksTakingsDownByPerson() {
        var serviceId = jdbc.queryForObject("""
                INSERT INTO service_item (salon_id, name, price, currency, duration_minutes, category, active, created_at)
                VALUES (?, 'Beard Trim', 15.00, 'EUR', 15, 'HAIR', true, now()) RETURNING id""", Long.class, salonId);
        for (var who : List.of("stylist", "stylist", "manager")) {
            client.post().uri("/api/salon-admin/" + salonId + "/dashboard/sales")
                    .header("Authorization", staffToken(salonId, who)).contentType(MediaType.APPLICATION_JSON)
                    .body("""
                            { "paymentMethod": "CASH",
                              "items": [ { "sourceType": "SERVICE", "sourceId": %d, "quantity": 1 } ] }""".formatted(serviceId))
                    .exchange().expectStatus().isOk();
        }
        get("/dashboard/reports/daily?zone=UTC", staffToken(salonId, "manager")).expectStatus().isOk().expectBody()
                .jsonPath("$.byPerson.length()").isEqualTo(2)
                .jsonPath("$.byPerson[?(@.person=='stylist-" + tag + "@desk.test')].count").value((List<Integer> c) ->
                        org.assertj.core.api.Assertions.assertThat(c).containsExactly(2))
                .jsonPath("$.byPerson[?(@.person=='manager-" + tag + "@desk.test')].count").value((List<Integer> c) ->
                        org.assertj.core.api.Assertions.assertThat(c).containsExactly(1));
    }

    @Test void myDeskSalonsListsOnlyTheSalonsTheCallerWorksAt() {
        client.get().uri("/api/salon-admin/my-desk-salons").header("Authorization", staffToken(salonId, "manager"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.length()").isEqualTo(1).jsonPath("$[0].id").isEqualTo(salonId.toString());
        client.get().uri("/api/salon-admin/my-desk-salons").header("Authorization", staffToken(salonId, "gone"))
                .exchange().expectStatus().isNotFound();
        // The email param is ignored when a token is present — no peeking at someone else's salons.
        client.get().uri("/api/salon-admin/my-desk-salons?email=stylist-" + tag + "@desk.test")
                .header("Authorization", staffToken(otherSalonId, "elsewhere"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.length()").isEqualTo(1).jsonPath("$[0].id").isEqualTo(otherSalonId.toString());
        // Staff aren't handed salons in the owner-only admin app.
        client.get().uri("/api/salon-admin/my-salons").header("Authorization", staffToken(salonId, "stylist"))
                .exchange().expectStatus().isNotFound();
    }
}
