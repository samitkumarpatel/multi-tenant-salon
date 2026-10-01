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

    private void putSettings(boolean booking, boolean cashier, boolean notifications, String message) {
        client.put()
                .uri("/api/salon-admin/{id}/dashboard/settings", salonId)
                .contentType(MediaType.APPLICATION_JSON)
                .body("""
                        {"bookingManagementEnabled": %s, "cashierEnabled": %s, "notificationsEnabled": %s, "defaultNotification": %s}
                        """.formatted(booking, cashier, notifications, message == null ? "null" : "\"" + message + "\""))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.bookingManagementEnabled").isEqualTo(booking)
                .jsonPath("$.cashierEnabled").isEqualTo(cashier)
                .jsonPath("$.notificationsEnabled").isEqualTo(notifications);
    }

    @Test
    void settingsDefaultToEnabledBeforeAnythingIsSaved() {
        client.get()
                .uri("/api/salon-admin/{id}/dashboard/settings", salonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.bookingManagementEnabled").isEqualTo(true)
                .jsonPath("$.cashierEnabled").isEqualTo(true)
                .jsonPath("$.notificationsEnabled").isEqualTo(true);
    }

    @Test
    void firstSaveIsPersistedAndReadBack() {
        // No dashboard_settings row exists yet — the first save must insert one.
        putSettings(true, false, false, "See you soon");

        client.get()
                .uri("/api/salon-admin/{id}/dashboard/settings", salonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.bookingManagementEnabled").isEqualTo(true)
                .jsonPath("$.cashierEnabled").isEqualTo(false)
                .jsonPath("$.notificationsEnabled").isEqualTo(false)
                .jsonPath("$.defaultNotification").isEqualTo("See you soon");
    }

    @Test
    void laterSavesOverwriteThePreviousOnes() {
        putSettings(false, false, true, null);
        putSettings(true, true, false, null);

        client.get()
                .uri("/api/salon-admin/{id}/dashboard/settings", salonId)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.bookingManagementEnabled").isEqualTo(true)
                .jsonPath("$.cashierEnabled").isEqualTo(true)
                .jsonPath("$.notificationsEnabled").isEqualTo(false);
    }

    @Test
    void disabledCashierIsEnforcedByTheCashierEndpoints() {
        putSettings(true, false, true, null);

        client.get()
                .uri("/api/salon-admin/{id}/dashboard/cashier/items", salonId)
                .exchange()
                .expectStatus().isForbidden();
    }
}
