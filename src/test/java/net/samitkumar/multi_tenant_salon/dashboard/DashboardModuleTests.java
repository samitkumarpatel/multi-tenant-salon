package net.samitkumar.multi_tenant_salon.dashboard;

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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@ApplicationModuleTest(mode = ApplicationModuleTest.BootstrapMode.ALL_DEPENDENCIES)
@Import(TestcontainersConfiguration.class)
class DashboardModuleTests {

    @Autowired
    JdbcTemplate jdbcTemplate;

    RestTestClient client;
    UUID salonId;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
        salonId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO salon (id, name, handler, owner_name, owner_email, created_at) VALUES (?, ?, ?, ?, ?, now())",
                salonId, "Dashboard Test Salon", "dashboard-test-" + salonId.toString().substring(0, 8),
                "Test Owner", "test@dashboard.com");
        jdbcTemplate.update("INSERT INTO salon_feature (salon_id, feature) VALUES (?, 'DASHBOARD')", salonId);
        jdbcTemplate.update("INSERT INTO salon_feature (salon_id, feature) VALUES (?, 'BOOKING')", salonId);
    }

    private void putSettings(boolean booking, boolean cashier) {
        client.put()
                .uri("/api/salon-admin/{id}/dashboard/settings", salonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"bookingManagementEnabled": %s, "cashierEnabled": %s}
                        """.formatted(booking, cashier))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.bookingManagementEnabled").isEqualTo(booking)
                .jsonPath("$.cashierEnabled").isEqualTo(cashier);
    }

    @Test
    void settingsDefaultToEnabledBeforeAnythingIsSaved() {
        client.get()
                .uri("/api/salon-admin/{id}/dashboard/settings", salonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.bookingManagementEnabled").isEqualTo(true)
                .jsonPath("$.cashierEnabled").isEqualTo(true);
    }

    @Test
    void firstSaveIsPersistedAndReadBack() {
        // No dashboard_settings row exists yet — the first save must insert one.
        putSettings(true, false);

        client.get()
                .uri("/api/salon-admin/{id}/dashboard/settings", salonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.bookingManagementEnabled").isEqualTo(true)
                .jsonPath("$.cashierEnabled").isEqualTo(false);
    }

    @Test
    void laterSavesOverwriteThePreviousOnes() {
        putSettings(false, false);
        putSettings(true, true);

        client.get()
                .uri("/api/salon-admin/{id}/dashboard/settings", salonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.bookingManagementEnabled").isEqualTo(true)
                .jsonPath("$.cashierEnabled").isEqualTo(true);
    }

    @Test
    void disabledCashierIsEnforcedByTheCashierEndpoints() {
        putSettings(true, false);

        client.get()
                .uri("/api/salon-admin/{id}/dashboard/cashier/items", salonId)
                .exchange()
                .expectStatus().isForbidden();
        // Settling an appointment is taking money too.
        client.get()
                .uri("/api/salon-admin/{id}/dashboard/cashier/bookings", salonId)
                .exchange()
                .expectStatus().isForbidden();
    }

    private Long insertSale(String paymentStatus, boolean voided) {
        var id = jdbcTemplate.queryForObject("""
                INSERT INTO pos_sale (salon_id, sale_number, customer_name, payment_method, total, currency, created_at, payment_status, voided_at)
                VALUES (?, ?, 'Eve', 'CASH', 30.00, 'EUR', now(), ?, ?) RETURNING id
                """, Long.class, salonId, "S-" + UUID.randomUUID().toString().substring(0, 8), paymentStatus,
                voided ? java.sql.Timestamp.from(java.time.Instant.now()) : null);
        jdbcTemplate.update("INSERT INTO pos_sale_line (sale_id, sale_key, source_type, source_id, item_name, unit_price, quantity, line_total) "
                + "VALUES (?, 0, 'SERVICE', 1, 'Cut', 15.00, 2, 30.00)", id);
        return id;
    }

    private org.springframework.test.web.servlet.client.RestTestClient.ResponseSpec postReceipt(Object saleId, String email) {
        return client.post().uri("/api/salon-admin/{id}/dashboard/sales/{sale}/receipt", salonId, saleId)
                .contentType(MediaType.APPLICATION_JSON).body("{\"email\":\"" + email + "\"}").exchange();
    }

    @Test
    void aSettledSaleReceiptIsAcceptedButBadRequestsAreRefused() {
        putSettings(true, true);
        postReceipt(insertSale("PAID", false), "eve@example.com").expectStatus().isAccepted();
        postReceipt(insertSale("PAID", false), "not-an-email").expectStatus().isBadRequest();
        postReceipt(insertSale("PAID", true), "eve@example.com").expectStatus().isEqualTo(409);
        postReceipt(insertSale("PENDING", false), "eve@example.com").expectStatus().isEqualTo(409);
        postReceipt(999999L, "eve@example.com").expectStatus().isNotFound();
    }

    @Test
    void receiptsAreClosedWhileTheCashierIsOff() {
        putSettings(true, false);
        postReceipt(insertSale("PAID", false), "eve@example.com").expectStatus().isForbidden();
    }

    private Long insertService(String price) {
        return jdbcTemplate.queryForObject("""
                INSERT INTO service_item (salon_id, name, price, currency, duration_minutes, category, active, created_at)
                VALUES (?, 'Cut', ?::numeric, 'EUR', 30, 'HAIR', true, now()) RETURNING id
                """, Long.class, salonId, price);
    }

    private org.springframework.test.web.servlet.client.RestTestClient.ResponseSpec sell(Long serviceId, String extra) {
        return client.post().uri("/api/salon-admin/{id}/dashboard/sales", salonId).contentType(MediaType.APPLICATION_JSON)
                .body("{\"paymentMethod\":\"CASH\",\"items\":[{\"sourceType\":\"SERVICE\",\"sourceId\":" + serviceId
                        + ",\"quantity\":2}]," + extra + "\"idempotencyKey\":\"" + UUID.randomUUID() + "\"}").exchange();
    }

    @Test
    void discountAndTipChangeWhatIsPaidAndAreKeptOnTheSale() {
        putSettings(true, true);
        var service = insertService("50.00"); // 2 x 50 = 100
        sell(service, "\"discountType\":\"PERCENT\",\"discountValue\":10,\"discountReason\":\"Regular\",\"tipAmount\":5,")
                .expectStatus().isOk().expectBody()
                .jsonPath("$.subtotal").isEqualTo(100.0).jsonPath("$.discountAmount").isEqualTo(10.0)
                .jsonPath("$.tipAmount").isEqualTo(5.0).jsonPath("$.total").isEqualTo(95.0)
                .jsonPath("$.discountReason").isEqualTo("Regular");
        sell(service, "\"discountType\":\"AMOUNT\",\"discountValue\":100,").expectStatus().isOk()
                .expectBody().jsonPath("$.total").isEqualTo(0.0);
        sell(service, "").expectStatus().isOk().expectBody().jsonPath("$.total").isEqualTo(100.0).jsonPath("$.discountAmount").isEqualTo(0.0);
    }

    @Test
    void impossibleDiscountsAndTipsAreRefused() {
        putSettings(true, true);
        var service = insertService("50.00");
        sell(service, "\"discountType\":\"AMOUNT\",\"discountValue\":100.01,").expectStatus().isBadRequest();
        sell(service, "\"discountType\":\"PERCENT\",\"discountValue\":101,").expectStatus().isBadRequest();
        sell(service, "\"discountType\":\"AMOUNT\",\"discountValue\":-1,").expectStatus().isBadRequest();
        sell(service, "\"tipAmount\":-1,").expectStatus().isBadRequest();
    }

    @Test
    void aShiftExpectsTheFloatPlusCashTakenAndFreezesTheDifferenceAtClose() {
        putSettings(true, true);
        client.get().uri("/api/salon-admin/{id}/dashboard/shift", salonId).exchange().expectStatus().isNoContent();
        client.post().uri("/api/salon-admin/{id}/dashboard/shift/open", salonId).contentType(MediaType.APPLICATION_JSON)
                .body("{\"openingFloat\":-1,\"currency\":\"EUR\"}").exchange().expectStatus().isBadRequest();
        client.post().uri("/api/salon-admin/{id}/dashboard/shift/open", salonId).contentType(MediaType.APPLICATION_JSON)
                .body("{\"openingFloat\":100,\"currency\":\"EUR\"}").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.openingFloat").isEqualTo(100.0);
        client.post().uri("/api/salon-admin/{id}/dashboard/shift/open", salonId).contentType(MediaType.APPLICATION_JSON)
                .body("{\"openingFloat\":50,\"currency\":\"EUR\"}").exchange().expectStatus().isEqualTo(409);

        sell(insertService("50.00"), "").expectStatus().isOk(); // 2 x 50 cash
        client.get().uri("/api/salon-admin/{id}/dashboard/shift", salonId).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.expectedCash").isEqualTo(200.0);

        client.post().uri("/api/salon-admin/{id}/dashboard/shift/close", salonId).contentType(MediaType.APPLICATION_JSON)
                .body("{\"countedCash\":195.50,\"note\":\"short\"}").exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.expectedCash").isEqualTo(200.0).jsonPath("$.difference").isEqualTo(-4.5)
                .jsonPath("$.note").isEqualTo("short");
        client.get().uri("/api/salon-admin/{id}/dashboard/shift", salonId).exchange().expectStatus().isNoContent();
        client.post().uri("/api/salon-admin/{id}/dashboard/shift/close", salonId).contentType(MediaType.APPLICATION_JSON)
                .body("{\"countedCash\":1}").exchange().expectStatus().isEqualTo(409);
        client.get().uri("/api/salon-admin/{id}/dashboard/shifts", salonId).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$[0].difference").isEqualTo(-4.5);
    }

    @Test
    void walkInsQueueInArrivalOrderAndLeaveTheQueueOnce() {
        putSettings(true, true);
        var service = insertService("30.00");
        for (var name : new String[]{"Ann", "Bo"}) {
            client.post().uri("/api/salon-admin/{id}/dashboard/walk-ins", salonId).contentType(MediaType.APPLICATION_JSON)
                    .body("{\"customerName\":\"" + name + "\",\"serviceId\":" + service + "}").exchange().expectStatus().isOk();
        }
        client.post().uri("/api/salon-admin/{id}/dashboard/walk-ins", salonId).contentType(MediaType.APPLICATION_JSON)
                .body("{\"customerName\":\"  \"}").exchange().expectStatus().isBadRequest();
        client.post().uri("/api/salon-admin/{id}/dashboard/walk-ins", salonId).contentType(MediaType.APPLICATION_JSON)
                .body("{\"customerName\":\"X\",\"serviceId\":999999}").exchange().expectStatus().isNotFound();
        var queue = client.get().uri("/api/salon-admin/{id}/dashboard/walk-ins", salonId).exchange().expectStatus().isOk()
                .returnResult(String.class).getResponseBody();
        assertThat((String) com.jayway.jsonpath.JsonPath.read(queue, "$[0].customerName")).isEqualTo("Ann");
        assertThat((String) com.jayway.jsonpath.JsonPath.read(queue, "$[0].serviceName")).isEqualTo("Cut");
        assertThat((java.util.List<?>) com.jayway.jsonpath.JsonPath.read(queue, "$")).hasSize(2);
        long first = ((Number) com.jayway.jsonpath.JsonPath.read(queue, "$[0].id")).longValue();
        client.post().uri("/api/salon-admin/{id}/dashboard/walk-ins/{w}/seat", salonId, first).exchange().expectStatus().isNoContent();
        client.post().uri("/api/salon-admin/{id}/dashboard/walk-ins/{w}/leave", salonId, first).exchange().expectStatus().isNotFound();
        var after = client.get().uri("/api/salon-admin/{id}/dashboard/walk-ins", salonId).exchange().returnResult(String.class).getResponseBody();
        assertThat((java.util.List<?>) com.jayway.jsonpath.JsonPath.read(after, "$")).hasSize(1);
        putSettings(false, true);
        client.get().uri("/api/salon-admin/{id}/dashboard/walk-ins", salonId).exchange().expectStatus().isForbidden();
    }
}
