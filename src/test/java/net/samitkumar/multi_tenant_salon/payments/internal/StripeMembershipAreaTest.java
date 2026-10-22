package net.samitkumar.multi_tenant_salon.payments.internal;

import net.samitkumar.multi_tenant_salon.payments.StripeConnectedAccount;
import net.samitkumar.multi_tenant_salon.payments.StripePaymentEvent;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.utility.CountryApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.client.RestClient;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/** Memberships are one more one-time Checkout area, exactly like SHOP, BOOKING and POS (its toggle: StripePaymentAreasIntegrationTest). */
class StripeMembershipAreaTest {
    final UUID salonId = UUID.fromString("50c0006f-bd2d-4824-b7ae-7439de4c8097");
    final StripeConnectedAccountRepository accounts = mock(StripeConnectedAccountRepository.class);
    final SalonApi salons = mock(SalonApi.class);
    final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    StripeConnectService service;

    @BeforeEach void setup() {
        var account = new StripeConnectedAccount(salonId, "acct_1", "DK", true, true, true, Instant.now());
        when(accounts.findById(salonId)).thenReturn(Optional.of(account));
        when(accounts.findByStripeAccountId("acct_1")).thenReturn(Optional.of(account));
        service = StripeTestSupport.service(accounts, salons, mock(CountryApi.class),
                StripeTestSupport.client(RestClient.builder(), null), mock(PaymentLedger.class), events, null, null,
                "https://book.salonsaas.org");
    }

    @Test void membershipCheckoutReturnsToTheWebsiteMembershipPage() {
        var salon = mock(Salon.class);
        when(salon.id()).thenReturn(salonId);
        when(salon.handler()).thenReturn("glow");
        assertThat(service.returnPage(salon, "MEMBERSHIP", null)).isEqualTo("https://glow.salonsaas.org/membership");
    }

    @Test void deskMembershipCheckoutReturnsToTheSalonDesk() {
        var salon = mock(Salon.class);
        when(salon.id()).thenReturn(salonId);
        when(salon.handler()).thenReturn("glow");
        var desk = "https://dashboard.salonsaas.org/" + salonId + "?view=membership&membershipView=sell";
        assertThat(service.returnPage(salon, "MEMBERSHIP", desk + "&payment=success&reference=7")).isEqualTo(desk);
        // Any other origin still falls back to the website's membership page — never an open redirect.
        assertThat(service.returnPage(salon, "MEMBERSHIP", "https://evil.example/" + salonId))
                .isEqualTo("https://glow.salonsaas.org/membership");
    }

    @Test void completedMembershipCheckoutPublishesThePaymentEvent() {
        send("""
                {"type":"checkout.session.completed","account":"acct_1","data":{"object":{
                  "id":"cs_1","mode":"payment","payment_status":"paid",
                  "metadata":{"salon_id":"%s","payment_area":"MEMBERSHIP","payment_reference":"42"}}}}
                """.formatted(salonId));
        verify(events).publishEvent(new StripePaymentEvent(salonId, "MEMBERSHIP", "42", "cs_1", true));
    }

    private void send(String payload) {
        try {
            var timestamp = Long.toString(Instant.now().getEpochSecond());
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec("whsec_x".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            var signature = HexFormat.of().formatHex(mac.doFinal((timestamp + "." + payload).getBytes(StandardCharsets.UTF_8)));
            service.handleWebhook(payload, "t=" + timestamp + ",v1=" + signature);
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
