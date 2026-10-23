package net.samitkumar.multi_tenant_salon.dashboard;

import net.samitkumar.multi_tenant_salon.MultiTenantSalonApplication;
import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import net.samitkumar.multi_tenant_salon.payments.internal.StripeConnectService;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A customer who booked online and pays when they arrive. The till pulls the appointment up instead
 * of making the operator re-pick the service, and settling the sale marks the appointment itself
 * paid. Full context, since this spans the dashboard, booking and service modules.
 */
@SpringBootTest(classes = MultiTenantSalonApplication.class)
@Import(TestcontainersConfiguration.class)
class DeskBookingPaymentTests {

    @Autowired JdbcTemplate jdbcTemplate;
    // Never reaches Stripe: these tests only need the card path to get as far as its own guards.
    @MockitoBean StripeConnectService stripe;
    RestTestClient client;
    UUID salonId;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
        salonId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO salon (id, name, handler, owner_name, owner_email, created_at) VALUES (?, ?, ?, ?, ?, now())",
                salonId, "Desk Till Salon", "desk-till-" + salonId.toString().substring(0, 8),
                "Owner", "owner@desk-till.test");
        jdbcTemplate.update("INSERT INTO salon_feature (salon_id, feature) VALUES (?, 'DASHBOARD')", salonId);
        jdbcTemplate.update("INSERT INTO salon_feature (salon_id, feature) VALUES (?, 'BOOKING')", salonId);
    }

    private String base() { return "/api/salon-admin/" + salonId + "/dashboard"; }

    /** A service, a stylist and an appointment for today in the given payment state. */
    private long bookingForToday(String customer, String paymentStatus) {
        var serviceId = jdbcTemplate.queryForObject("""
                INSERT INTO service_item (salon_id, name, price, currency, duration_minutes, category, active, created_at)
                VALUES (?, 'Classic Haircut', 42.00, 'EUR', 30, 'HAIR', true, now()) RETURNING id""", Long.class, salonId);
        var staffId = jdbcTemplate.queryForObject("""
                INSERT INTO staff_member (salon_id, name, email, role, status, created_at)
                VALUES (?, 'Marcus', ?, 'STYLIST', 'ACTIVE', now()) RETURNING id""",
                Long.class, salonId, "marcus-" + UUID.randomUUID() + "@test.example");
        return jdbcTemplate.queryForObject("""
                INSERT INTO booking (salon_id, service_id, staff_id, customer_name, customer_email,
                                     appointment_date, start_time, end_time, status, payment_status, created_at)
                VALUES (?, ?, ?, ?, 'walkin@test.example', CURRENT_DATE, '10:00', '10:30', 'CONFIRMED', ?, now())
                RETURNING id""", Long.class, salonId, serviceId, staffId, customer, paymentStatus);
    }

    private String saleBody(long bookingId, String method) {
        return """
                { "customerName": "Walk In", "paymentMethod": "%s",
                  "items": [ { "sourceType": "BOOKING", "sourceId": %d, "quantity": 1 } ] }
                """.formatted(method, bookingId);
    }

    private String paymentStatusOf(long bookingId) {
        return jdbcTemplate.queryForObject("SELECT payment_status FROM booking WHERE id = ?", String.class, bookingId);
    }

    @Test
    void anOnlineBookingIsPulledUpAtTheTillAndPaidInCash() {
        long bookingId = bookingForToday("Ann Doe", "NOT_REQUIRED");

        // Offered by the till, priced from its service and labelled with who and when.
        client.get().uri(base() + "/cashier/bookings").exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.length()").isEqualTo(1)
                .jsonPath("$[0].sourceType").isEqualTo("BOOKING")
                .jsonPath("$[0].sourceId").isEqualTo(bookingId)
                .jsonPath("$[0].name").isEqualTo("Classic Haircut")
                .jsonPath("$[0].detail").value((String d) -> assertThat(d).contains("Ann Doe").contains("10:00"))
                .jsonPath("$[0].price").isEqualTo(42.00);

        client.post().uri(base() + "/sales").contentType(MediaType.APPLICATION_JSON)
                .body(saleBody(bookingId, "CASH"))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.total").isEqualTo(42.00)
                .jsonPath("$.paymentStatus").isEqualTo("PAID")
                .jsonPath("$.lines[0].sourceType").isEqualTo("BOOKING")
                .jsonPath("$.lines[0].itemName").isEqualTo("Classic Haircut");

        // The appointment now reads as paid, referencing the till sale that settled it.
        var row = jdbcTemplate.queryForMap("SELECT payment_status, payment_reference FROM booking WHERE id = ?", bookingId);
        assertThat(row.get("payment_status")).isEqualTo("PAID");
        assertThat((String) row.get("payment_reference")).startsWith("POS-");

        // And it leaves the till's list, so it can't be charged for a second time.
        client.get().uri(base() + "/cashier/bookings").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.length()").isEqualTo(0);
        client.post().uri(base() + "/sales").contentType(MediaType.APPLICATION_JSON)
                .body(saleBody(bookingId, "CASH")).exchange().expectStatus().isEqualTo(409);
    }

    @Test
    void anAbandonedOnlinePaymentCanStillBeSettledAtTheCounter() {
        // Started paying online and never finished — still owed, so still payable at the desk.
        long bookingId = bookingForToday("Bo Roe", "PENDING");
        client.get().uri(base() + "/cashier/bookings").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.length()").isEqualTo(1);

        client.post().uri(base() + "/sales").contentType(MediaType.APPLICATION_JSON)
                .body(saleBody(bookingId, "OTHER")).exchange().expectStatus().isOk();

        assertThat(paymentStatusOf(bookingId)).isEqualTo("PAID");
    }

    @Test
    void cancelledAndAlreadyPaidAppointmentsAreNeitherOfferedNorChargeable() {
        long paid = bookingForToday("Already Paid", "PAID");
        long cancelled = bookingForToday("Called Off", "NOT_REQUIRED");
        jdbcTemplate.update("UPDATE booking SET status = 'CANCELLED' WHERE id = ?", cancelled);

        client.get().uri(base() + "/cashier/bookings").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.length()").isEqualTo(0);

        for (long id : new long[] {paid, cancelled}) {
            client.post().uri(base() + "/sales").contentType(MediaType.APPLICATION_JSON)
                    .body(saleBody(id, "CASH")).exchange().expectStatus().isEqualTo(409);
        }
        // Neither was touched by the refused sales.
        assertThat(paymentStatusOf(paid)).isEqualTo("PAID");
        assertThat(paymentStatusOf(cancelled)).isEqualTo("NOT_REQUIRED");
    }

    @Test
    void anAppointmentIsPaidForOnceNotByTheQuantity() {
        long bookingId = bookingForToday("Ann Doe", "NOT_REQUIRED");
        client.post().uri(base() + "/sales").contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "paymentMethod": "CASH",
                          "items": [ { "sourceType": "BOOKING", "sourceId": %d, "quantity": 2 } ] }
                        """.formatted(bookingId))
                .exchange().expectStatus().isEqualTo(400);
        assertThat(paymentStatusOf(bookingId)).isEqualTo("NOT_REQUIRED");
    }

    @Test
    void ringingUpTheSameCartTwiceDoesNotChargeTwice() {
        // A plain service cart: unlike an appointment, nothing else stops it being rung up twice,
        // so this is the case where a lost response really would charge the customer again.
        var serviceId = jdbcTemplate.queryForObject("""
                INSERT INTO service_item (salon_id, name, price, currency, duration_minutes, category, active, created_at)
                VALUES (?, 'Beard Trim', 15.00, 'EUR', 15, 'HAIR', true, now()) RETURNING id""", Long.class, salonId);
        var body = """
                { "customerName": "Ann", "paymentMethod": "CASH", "idempotencyKey": "cart-abc-123",
                  "items": [ { "sourceType": "SERVICE", "sourceId": %d, "quantity": 1 } ] }
                """.formatted(serviceId);

        var first = client.post().uri(base() + "/sales").contentType(MediaType.APPLICATION_JSON).body(body)
                .exchange().expectStatus().isOk().expectBody().returnResult().getResponseBody();
        // The reply was lost and the operator tapped again: the same sale comes back, not a second one.
        var second = client.post().uri(base() + "/sales").contentType(MediaType.APPLICATION_JSON).body(body)
                .exchange().expectStatus().isOk().expectBody().returnResult().getResponseBody();

        assertThat(saleNumberOf(first)).isEqualTo(saleNumberOf(second));
        assertThat(jdbcTemplate.queryForObject(
                "SELECT count(*) FROM pos_sale WHERE salon_id = ?", Integer.class, salonId)).isEqualTo(1);
    }

    @Test
    void voidingASaleGivesBackTheStockAndOwesTheAppointmentAgain() {
        long bookingId = bookingForToday("Ann Doe", "NOT_REQUIRED");
        var sale = client.post().uri(base() + "/sales").contentType(MediaType.APPLICATION_JSON)
                .body(saleBody(bookingId, "CASH"))
                .exchange().expectStatus().isOk().expectBody().returnResult().getResponseBody();
        long saleId = ((Number) com.jayway.jsonpath.JsonPath.read(
                new String(sale, java.nio.charset.StandardCharsets.UTF_8), "$.id")).longValue();
        assertThat(paymentStatusOf(bookingId)).isEqualTo("PAID");

        client.post().uri(base() + "/sales/" + saleId + "/void").contentType(MediaType.APPLICATION_JSON)
                .body("{ \"reason\": \"Rang up the wrong customer\" }")
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.voidedAt").isNotEmpty()
                .jsonPath("$.voidReason").isEqualTo("Rang up the wrong customer");

        // The appointment is owed again and reappears on the till.
        assertThat(paymentStatusOf(bookingId)).isEqualTo("NOT_REQUIRED");
        client.get().uri(base() + "/cashier/bookings").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.length()").isEqualTo(1);

        // Voiding twice is refused, so nothing is credited back a second time.
        client.post().uri(base() + "/sales/" + saleId + "/void").contentType(MediaType.APPLICATION_JSON)
                .body("{}").exchange().expectStatus().isEqualTo(409);
    }

    private static String saleNumberOf(byte[] body) {
        return com.jayway.jsonpath.JsonPath.read(
                new String(body, java.nio.charset.StandardCharsets.UTF_8), "$.saleNumber");
    }

    @Test
    void aCartAlreadyRungUpAsCashCannotBeReplayedAsCard() {
        var serviceId = jdbcTemplate.queryForObject("""
                INSERT INTO service_item (salon_id, name, price, currency, duration_minutes, category, active, created_at)
                VALUES (?, 'Beard Trim', 15.00, 'EUR', 15, 'HAIR', true, now()) RETURNING id""", Long.class, salonId);
        String items = """
                "items": [ { "sourceType": "SERVICE", "sourceId": %d, "quantity": 1 } ]""".formatted(serviceId);

        client.post().uri(base() + "/sales").contentType(MediaType.APPLICATION_JSON)
                .body("{ \"paymentMethod\": \"CASH\", \"idempotencyKey\": \"cart-1\", " + items + " }")
                .exchange().expectStatus().isOk();

        // The reply was lost; the operator switches to card and retries the same cart. The paid cash
        // sale must neither be handed back as if it were the card sale nor flipped to PENDING.
        client.post().uri(base() + "/sales/card-checkout").contentType(MediaType.APPLICATION_JSON)
                .body("{ \"paymentMethod\": \"CARD\", \"idempotencyKey\": \"cart-1\", " + items + " }")
                .exchange().expectStatus().isEqualTo(409);

        assertThat(jdbcTemplate.queryForList(
                "SELECT payment_status FROM pos_sale WHERE salon_id = ?", String.class, salonId))
                .containsExactly("PAID");
    }

    @Test
    void sellingMoreThanIsInStockNamesTheProduct() {
        jdbcTemplate.update("INSERT INTO salon_feature (salon_id, feature) VALUES (?, 'WEBSHOP')", salonId);
        var productId = jdbcTemplate.queryForObject("""
                INSERT INTO product (salon_id, name, active, created_at) VALUES (?, 'Argan Oil Serum', true, now())
                RETURNING id""", Long.class, salonId);
        var variantId = jdbcTemplate.queryForObject("""
                INSERT INTO product_variant (product_id, salon_id, label, price, currency, quantity_on_hand, active)
                VALUES (?, ?, '50 ml', 20.00, 'EUR', 1, true) RETURNING id""", Long.class, productId, salonId);

        client.post().uri(base() + "/sales").contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "paymentMethod": "CASH",
                          "items": [ { "sourceType": "PRODUCT", "sourceId": %d, "quantity": 2 } ] }
                        """.formatted(variantId))
                .exchange().expectStatus().isEqualTo(409).expectBody()
                .jsonPath("$.detail").value((String d) ->
                        assertThat(d).contains("Argan Oil Serum").contains("50 ml").contains("out of stock"));
    }


    // ── The end-of-day sheet ─────────────────────────────────────────────────

    private long serviceCosting(String name, String price) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO service_item (salon_id, name, price, currency, duration_minutes, category, active, created_at)
                VALUES (?, ?, ?::numeric, 'EUR', 15, 'HAIR', true, now()) RETURNING id""", Long.class, salonId, name, price);
    }

    private long ringUp(long serviceId, String method) {
        var body = client.post().uri(base() + "/sales").contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "paymentMethod": "%s",
                          "items": [ { "sourceType": "SERVICE", "sourceId": %d, "quantity": 1 } ] }
                        """.formatted(method, serviceId))
                .exchange().expectStatus().isOk().expectBody().returnResult().getResponseBody();
        return ((Number) com.jayway.jsonpath.JsonPath.read(
                new String(body, java.nio.charset.StandardCharsets.UTF_8), "$.id")).longValue();
    }

    @Test
    void theDaySheetCountsSettledSalesByMethodAndSetsAsideVoidedAndPending() {
        long trim = serviceCosting("Beard Trim", "15.00");
        ringUp(trim, "CASH");
        ringUp(trim, "CASH");
        ringUp(trim, "OTHER");
        long mistake = ringUp(trim, "CASH");
        client.post().uri(base() + "/sales/" + mistake + "/void").contentType(MediaType.APPLICATION_JSON)
                .body("{}").exchange().expectStatus().isOk();
        // A card sale still waiting is not money in the drawer.
        jdbcTemplate.update("""
                INSERT INTO pos_sale (salon_id, sale_number, payment_method, total, currency, created_at, payment_status)
                VALUES (?, 'POS-WAITING', 'CARD', 99.00, 'EUR', now(), 'PENDING')""", salonId);

        var today = java.time.LocalDate.now(java.time.ZoneOffset.UTC);
        client.get().uri(base() + "/reports/daily?date=" + today + "&zone=UTC").exchange()
                .expectStatus().isOk().expectBody()
                .jsonPath("$.takings[?(@.method=='CASH')].count").value((java.util.List<Integer> c) ->
                        assertThat(c).containsExactly(2))
                .jsonPath("$.takings[?(@.method=='CASH')].total").value((java.util.List<Number> t) ->
                        assertThat(t.get(0).doubleValue()).isEqualTo(30.00))
                .jsonPath("$.takings[?(@.method=='OTHER')].total").value((java.util.List<Number> t) ->
                        assertThat(t.get(0).doubleValue()).isEqualTo(15.00))
                // the voided one is neither takings nor silently dropped
                .jsonPath("$.voided[0].count").isEqualTo(1)
                .jsonPath("$.voided[0].total").isEqualTo(15.00)
                // the waiting card sale is flagged, not counted
                .jsonPath("$.awaitingPayment").isEqualTo(1)
                .jsonPath("$.takings[?(@.method=='CARD')]").isEmpty();
    }

    @Test
    void aSaleJustAfterLocalMidnightBelongsToTheLocalDayNotTheUtcOne() {
        // 23:30 UTC on the 10th is 00:30 on the 11th in Copenhagen (UTC+1 in March, before DST).
        jdbcTemplate.update("""
                INSERT INTO pos_sale (salon_id, sale_number, payment_method, total, currency, created_at, payment_status)
                VALUES (?, 'POS-LATE', 'CASH', 40.00, 'EUR', '2026-03-10 23:30:00+00', 'PAID')""", salonId);

        client.get().uri(base() + "/reports/daily?date=2026-03-11&zone=Europe/Copenhagen").exchange()
                .expectStatus().isOk().expectBody().jsonPath("$.takings.length()").isEqualTo(1);
        client.get().uri(base() + "/reports/daily?date=2026-03-10&zone=Europe/Copenhagen").exchange()
                .expectStatus().isOk().expectBody().jsonPath("$.takings.length()").isEqualTo(0);
        // The same instant read in UTC is still the 10th.
        client.get().uri(base() + "/reports/daily?date=2026-03-10&zone=UTC").exchange()
                .expectStatus().isOk().expectBody().jsonPath("$.takings.length()").isEqualTo(1);
        // A bogus zone degrades to UTC rather than failing the report.
        client.get().uri(base() + "/reports/daily?date=2026-03-10&zone=Not/AZone").exchange()
                .expectStatus().isOk().expectBody().jsonPath("$.zone").isEqualTo("Z");
    }

    @Test
    void theDaySheetIsClosedWhenTheCashierIsOff() {
        jdbcTemplate.update("INSERT INTO dashboard_settings (salon_id, booking_management_enabled, cashier_enabled, updated_at) "
                + "VALUES (?, true, false, now())", salonId);
        client.get().uri(base() + "/reports/daily").exchange().expectStatus().isForbidden();
    }

    @Test
    void anAppointmentCanShareASaleWithOtherItems() {
        long bookingId = bookingForToday("Ann Doe", "NOT_REQUIRED");
        var serviceId = jdbcTemplate.queryForObject("""
                INSERT INTO service_item (salon_id, name, price, currency, duration_minutes, category, active, created_at)
                VALUES (?, 'Blow Dry', 8.00, 'EUR', 15, 'HAIR', true, now()) RETURNING id""", Long.class, salonId);

        client.post().uri(base() + "/sales").contentType(MediaType.APPLICATION_JSON)
                .body("""
                        { "paymentMethod": "CASH", "items": [
                          { "sourceType": "BOOKING", "sourceId": %d, "quantity": 1 },
                          { "sourceType": "SERVICE", "sourceId": %d, "quantity": 1 } ] }
                        """.formatted(bookingId, serviceId))
                .exchange().expectStatus().isOk().expectBody()
                .jsonPath("$.total").isEqualTo(50.00)
                .jsonPath("$.lines.length()").isEqualTo(2);

        assertThat(paymentStatusOf(bookingId)).isEqualTo("PAID");
    }
}
