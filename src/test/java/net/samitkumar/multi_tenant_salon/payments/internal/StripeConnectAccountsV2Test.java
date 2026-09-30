package net.samitkumar.multi_tenant_salon.payments.internal;

import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.utility.Country;
import net.samitkumar.multi_tenant_salon.utility.CountryApi;
import net.samitkumar.multi_tenant_salon.website.WebsiteDomainApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class StripeConnectAccountsV2Test {
    final UUID salonId = UUID.fromString("50c0006f-bd2d-4824-b7ae-7439de4c8097");
    final StripeConnectedAccountRepository accounts = mock(StripeConnectedAccountRepository.class);
    final SalonApi salons = mock(SalonApi.class);
    final CountryApi countries = mock(CountryApi.class);
    MockRestServiceServer server;
    StripeConnectService service;

    @SuppressWarnings("unchecked")
    @BeforeEach void setup() {
        var salon = mock(Salon.class);
        when(salon.id()).thenReturn(salonId);
        when(salon.name()).thenReturn("Glow Studio");
        when(salon.handler()).thenReturn("glow");
        when(salon.owner()).thenReturn(new Salon.Owner("Ann", "ann@glow.dk", null));
        when(salon.location()).thenReturn(new Salon.Location(null, null, null, "Denmark", null));
        when(salons.findById(salonId)).thenReturn(Optional.of(salon));
        when(accounts.findById(salonId)).thenReturn(Optional.empty());
        when(countries.findByName("Denmark")).thenReturn(Optional.of(new Country("Denmark", "dk", "+45", "DKK", null, null, null, null)));
        var builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        service = new StripeConnectService(accounts, mock(SalonPaymentSettingsRepository.class), salons, countries, builder,
                "sk_test_x", "https://admin.salonsaas.org", "https://dashboard.salonsaas.org", "whsec_x",
                "https://book.salonsaas.org", "", "salonsaas.org", mock(ApplicationEventPublisher.class),
                mock(JdbcTemplate.class), mock(ObjectProvider.class), "2026-08-26.dahlia");
    }

    void expectNoExistingAccount() {
        server.expect(requestTo("https://api.stripe.com/v2/core/accounts?limit=100"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {"data":[{"id":"acct_other","metadata":{"salon_id":"someone-else"}}],"next_page_url":null}
                        """, MediaType.APPLICATION_JSON));
    }

    @Test void onboardingCreatesAccountsV2MerchantAndV2AccountLink() {
        expectNoExistingAccount();
        server.expect(requestTo("https://api.stripe.com/v2/core/accounts"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Stripe-Version", "2026-08-26.dahlia"))
                .andExpect(header("Idempotency-Key", org.hamcrest.Matchers.startsWith("salon-connect-v2-" + salonId + "-")))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.identity.country").value("dk"))
                .andExpect(jsonPath("$.contact_email").value("ann@glow.dk"))
                .andExpect(jsonPath("$.display_name").value("Glow Studio"))
                .andExpect(jsonPath("$.dashboard").value("full"))
                .andExpect(jsonPath("$.configuration.merchant.capabilities.card_payments.requested").value(true))
                .andExpect(jsonPath("$.defaults.responsibilities.fees_collector").value("stripe"))
                .andExpect(jsonPath("$.defaults.responsibilities.losses_collector").value("stripe"))
                .andExpect(jsonPath("$.metadata.salon_id").value(salonId.toString()))
                .andRespond(withSuccess("""
                        {"id":"acct_v2","object":"v2.core.account","configuration":{"merchant":{"capabilities":
                        {"card_payments":{"status":"restricted"}}}},"requirements":{"summary":{"minimum_deadline":{"status":"currently_due"}}}}
                        """, MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.stripe.com/v2/core/account_links"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Stripe-Version", "2026-08-26.dahlia"))
                .andExpect(jsonPath("$.account").value("acct_v2"))
                .andExpect(jsonPath("$.use_case.type").value("account_onboarding"))
                .andExpect(jsonPath("$.use_case.account_onboarding.configurations[0]").value("merchant"))
                .andExpect(jsonPath("$.use_case.account_onboarding.return_url")
                        .value("https://admin.salonsaas.org/" + salonId + "/payments?stripe=return"))
                .andExpect(jsonPath("$.use_case.account_onboarding.refresh_url")
                        .value("https://admin.salonsaas.org/" + salonId + "/payments?stripe=refresh"))
                .andRespond(withSuccess("{\"url\":\"https://accounts.stripe.com/r/acct_v2#alu_test\"}", MediaType.APPLICATION_JSON));

        assertThat(service.onboardingUrl(salonId)).isEqualTo("https://accounts.stripe.com/r/acct_v2#alu_test");
        server.verify();
    }

    @Test void onboardingAdoptsAccountCreatedByAnEarlierUnsavedAttempt() {
        server.expect(requestTo("https://api.stripe.com/v2/core/accounts?limit=100"))
                .andRespond(withSuccess("""
                        {"data":[{"id":"acct_other","metadata":{}}],"next_page_url":"/v2/core/accounts?limit=100&page=p2"}
                        """, MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.stripe.com/v2/core/accounts?limit=100&page=p2"))
                .andRespond(withSuccess("""
                        {"data":[{"id":"acct_orphan","metadata":{"salon_id":"%s"}}],"next_page_url":null}
                        """.formatted(salonId), MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.stripe.com/v2/core/accounts/acct_orphan?include[0]=configuration.merchant&include[1]=requirements"))
                .andRespond(withSuccess("{\"id\":\"acct_orphan\",\"requirements\":{}}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.stripe.com/v2/core/account_links"))
                .andExpect(jsonPath("$.account").value("acct_orphan"))
                .andRespond(withSuccess("{\"url\":\"https://accounts.stripe.com/r/acct_orphan\"}", MediaType.APPLICATION_JSON));

        assertThat(service.onboardingUrl(salonId)).isEqualTo("https://accounts.stripe.com/r/acct_orphan");
        server.verify();
    }

    @Test void idempotencyKeyFollowsTheRequestBody() {
        var body = StripeConnectService.accountRequest(salons.findById(salonId).orElseThrow(), "DK");
        var key = StripeConnectService.accountIdempotencyKey(salonId, body);
        assertThat(StripeConnectService.accountIdempotencyKey(salonId, StripeConnectService.accountRequest(salons.findById(salonId).orElseThrow(), "DK")))
                .isEqualTo(key);
        var renamed = new java.util.TreeMap<>(body);
        renamed.put("display_name", "Glow Studio Copenhagen");
        assertThat(StripeConnectService.accountIdempotencyKey(salonId, renamed)).isNotEqualTo(key);
    }

    @Test void surfacesStripesErrorMessage() {
        expectNoExistingAccount();
        server.expect(requestTo("https://api.stripe.com/v2/core/accounts"))
                .andRespond(withStatus(HttpStatus.BAD_REQUEST).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":{\"type\":\"invalid_request_error\",\"message\":\"Platform must be activated to create connected accounts.\"}}"));
        assertThatThrownBy(() -> service.onboardingUrl(salonId))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
                    assertThat(e.getReason()).isEqualTo("Stripe request failed: Platform must be activated to create connected accounts.");
                });
    }

    @Test void mapsV2AccountStateToConnectFlags() {
        var ready = StripeConnectService.accountState(salonId, "DK", Map.of("id", "acct_v2",
                "configuration", Map.of("merchant", Map.of("capabilities", Map.of(
                        "card_payments", Map.of("status", "active"),
                        "stripe_balance", Map.of("payouts", Map.of("status", "active"))))),
                "requirements", Map.of("summary", Map.of("minimum_deadline", Map.of("status", "eventually_due")))));
        assertThat(ready.detailsSubmitted()).isTrue();
        assertThat(ready.chargesEnabled()).isTrue();
        assertThat(ready.payoutsEnabled()).isTrue();

        var noRequirements = StripeConnectService.accountState(salonId, "DK", Map.of("id", "acct_v2",
                "requirements", Map.of("entries", java.util.List.of())));
        assertThat(noRequirements.detailsSubmitted()).isTrue();
        assertThat(noRequirements.chargesEnabled()).isFalse();

        var pending = StripeConnectService.accountState(salonId, "DK", Map.of("id", "acct_v2",
                "requirements", Map.of("summary", Map.of("minimum_deadline", Map.of("status", "past_due")))));
        assertThat(pending.detailsSubmitted()).isFalse();
        assertThat(pending.payoutsEnabled()).isFalse();
    }
}
