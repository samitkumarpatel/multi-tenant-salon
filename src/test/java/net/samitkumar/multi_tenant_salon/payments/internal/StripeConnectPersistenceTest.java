package net.samitkumar.multi_tenant_salon.payments.internal;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import net.samitkumar.multi_tenant_salon.payments.SalonPaymentSettings;
import net.samitkumar.multi_tenant_salon.payments.StripeConnectedAccount;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The upserts run through JdbcClient against real PostgreSQL — mocked JDBC can't catch type-binding errors. */
@SpringBootTest(properties = {
        "spring.flyway.enabled=true", "spring.sql.init.mode=never",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://auth.test"
})
@Import(TestcontainersConfiguration.class)
class StripeConnectPersistenceTest {
    @Autowired StripeConnectService service;
    @Autowired StripeConnectedAccountRepository accounts;
    @Autowired SalonPaymentSettingsRepository settings;
    @Autowired JdbcTemplate jdbc;

    @Test void upsertsConnectedAccountAndPaymentSettings() {
        var salonId = UUID.randomUUID();
        jdbc.update("INSERT INTO salon(id, name, handler, created_at) VALUES (?, 'Pay test', ?, now())", salonId, "pay-" + salonId);
        var now = Instant.now().truncatedTo(ChronoUnit.MILLIS);

        service.saveAccount(new StripeConnectedAccount(salonId, "acct_" + salonId.toString().substring(0, 8), "DK", false, false, false, now));
        service.saveAccount(new StripeConnectedAccount(salonId, "acct_" + salonId.toString().substring(0, 8), "DK", true, true, false, now.plusSeconds(5)));
        var saved = accounts.findById(salonId).orElseThrow();
        assertThat(saved.detailsSubmitted()).isTrue();
        assertThat(saved.chargesEnabled()).isTrue();
        assertThat(saved.updatedAt()).isEqualTo(now.plusSeconds(5));

        service.update(salonId, false, false, false, SalonPaymentSettings.BookingPaymentType.DEPOSIT, 30);
        var stored = settings.findById(salonId).orElseThrow();
        assertThat(stored.bookingPaymentType()).isEqualTo(SalonPaymentSettings.BookingPaymentType.DEPOSIT);
        assertThat(stored.bookingDepositPercent()).isEqualTo(30);
        assertThat(stored.updatedAt()).isNotNull();
    }
}
