package net.samitkumar.multi_tenant_salon.payments.internal;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import net.samitkumar.multi_tenant_salon.payments.CheckoutUi;
import net.samitkumar.multi_tenant_salon.payments.PaymentGateway;
import net.samitkumar.multi_tenant_salon.payments.SalonPaymentSettings;
import net.samitkumar.multi_tenant_salon.payments.SalonPaymentSettings.AreaSetting;
import net.samitkumar.multi_tenant_salon.payments.StripeConnectedAccount;
import net.samitkumar.multi_tenant_salon.payments.StripePaymentEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.util.MultiValueMap;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

/**
 * Payment areas, checkout styles, the ledger, refunds and card readers against real PostgreSQL. Only the HTTP
 * calls to Stripe are replaced ({@link StripeClient}); webhooks go through signature verification as in production.
 */
@SpringBootTest(properties = {
        "spring.flyway.enabled=true", "spring.sql.init.mode=never",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://auth.test",
        "spring.application.payments.stripe-webhook-secret=whsec_flow"
})
@Import(TestcontainersConfiguration.class)
@RecordApplicationEvents
class StripePaymentFlowIntegrationTest {
    @Autowired StripeConnectService service;
    @Autowired StripeTerminalService terminals;
    @Autowired StripeRefundService refunds;
    @Autowired PaymentLedger ledger;
    @Autowired SalonApi salonApi;
    @Autowired JdbcTemplate jdbc;
    @Autowired ApplicationEvents events;
    @MockitoBean StripeClient stripe;

    UUID salonId;
    String acct;

    @BeforeEach void setup() {
        salonId = UUID.randomUUID();
        acct = "acct_" + salonId.toString().substring(0, 8);
        jdbc.update("INSERT INTO salon(id, name, handler, address, city, zip_code, country, created_at)"
                + " VALUES (?, 'Glow Studio', ?, 'Main St 1', 'Copenhagen', '2100', 'Denmark', now())", salonId, "glow-" + salonId);
        for (var feature : List.of("WEBSHOP", "BOOKING", "DASHBOARD", "MEMBERSHIP")) {
            jdbc.update("INSERT INTO salon_feature (salon_id, feature) VALUES (?, ?)", salonId, feature);
        }
        jdbc.update("INSERT INTO salon_website_theme (salon_id, hero_bg, hero_text_color, accent_color, font_family, logo_bg_color, updated_at)"
                + " VALUES (?, '#fdf2f8', '#111111', '#db2777', 'Lora', '#ffffff', now())", salonId);
        service.saveAccount(new StripeConnectedAccount(salonId, acct, "DK", true, true, true, Instant.now()));
        when(stripe.secretConfigured()).thenReturn(true);
        when(stripe.testMode()).thenReturn(true);
        when(stripe.publishableKey()).thenReturn("pk_test_flow");
        // requireEnabled re-reads the account: Stripe says card payments are active.
        when(stripe.getV2(anyString())).thenReturn(Map.of("id", acct,
                "requirements", Map.of("summary", Map.of("minimum_deadline", Map.of("status", "eventually_due"))),
                "configuration", Map.of("merchant", Map.of("capabilities", Map.of("card_payments", Map.of("status", "active"))))));
    }

    // ── Areas & checkout style ──────────────────────────────────────────────

    @Test void areasKeepTheirOwnToggleAndCheckoutStyle() {
        var saved = service.update(salonId, List.of(new AreaSetting("SHOP", true, CheckoutUi.ELEMENTS),
                new AreaSetting("MEMBERSHIP", true, CheckoutUi.EMBEDDED)), SalonPaymentSettings.BookingPaymentType.DEPOSIT, 30);
        assertThat(saved.area("SHOP")).isEqualTo(new AreaSetting("SHOP", true, CheckoutUi.ELEMENTS));
        assertThat(saved.area("MEMBERSHIP").checkoutUi()).isEqualTo(CheckoutUi.EMBEDDED);
        assertThat(saved.area("BOOKING").enabled()).isFalse();
        assertThat(saved.bookingDepositPercent()).isEqualTo(30);
        assertThat(service.enabled(salonId, "SHOP")).isTrue();
        assertThat(service.enabled(salonId, "POS")).isFalse();

        // A partial update leaves the other areas as they were.
        service.update(salonId, List.of(new AreaSetting("POS", true, CheckoutUi.REDIRECT)), SalonPaymentSettings.BookingPaymentType.FULL, 20);
        assertThat(service.settings(salonId).area("SHOP").checkoutUi()).isEqualTo(CheckoutUi.ELEMENTS);
        assertThat(service.enabled(salonId, "POS")).isTrue();
    }

    @Test void inPageCheckoutNeedsThePublishableKey() {
        when(stripe.publishableKey()).thenReturn(null);
        assertThatThrownBy(() -> service.update(salonId, List.of(new AreaSetting("SHOP", true, CheckoutUi.ELEMENTS)),
                SalonPaymentSettings.BookingPaymentType.FULL, 20))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test void redirectCheckoutCarriesTheSalonBrandAndIsRecorded() {
        service.update(salonId, List.of(new AreaSetting("SHOP", true, CheckoutUi.REDIRECT)), SalonPaymentSettings.BookingPaymentType.FULL, 20);
        when(stripe.post(eq("/v1/checkout/sessions"), any(), anyString(), eq(acct)))
                .thenReturn(Map.of("id", "cs_redirect_" + salonId, "url", "https://checkout.stripe.com/c/pay/cs_1"));

        var checkout = service.createCheckout(salonId, new PaymentGateway.CheckoutRequest("SHOP", "41", new BigDecimal("12.50"),
                "DKK", "Order SO-41", null, "eva@example.com", true));

        assertThat(checkout.ui()).isEqualTo(CheckoutUi.REDIRECT);
        assertThat(checkout.url()).isEqualTo("https://checkout.stripe.com/c/pay/cs_1");
        var form = sentForm("/v1/checkout/sessions");
        assertThat(form.getFirst("ui_mode")).isEqualTo("hosted_page");
        assertThat(form.getFirst("success_url")).contains("payment=success").contains("reference=41");
        assertThat(form.getFirst("cancel_url")).contains("payment=cancel");
        assertThat(form.getFirst("line_items[0][price_data][unit_amount]")).isEqualTo("1250");
        assertThat(form.getFirst("customer_email")).isEqualTo("eva@example.com");
        assertThat(form.getFirst("branding_settings[display_name]")).isEqualTo("Glow Studio");
        assertThat(form.getFirst("branding_settings[button_color]")).isEqualTo("#DB2777");
        assertThat(form.getFirst("branding_settings[background_color]")).isEqualTo("#FDF2F8");
        assertThat(form.getFirst("payment_intent_data[metadata][payment_channel]")).isEqualTo("CHECKOUT");

        var payment = ledger.findBySession("cs_redirect_" + salonId).orElseThrow();
        assertThat(payment.status()).isEqualTo("PENDING");
        assertThat(payment.amount()).isEqualByComparingTo("12.50");
        assertThat(payment.checkoutUi()).isEqualTo(CheckoutUi.REDIRECT);
    }

    @Test void elementsCheckoutReturnsAClientSecretOnlyWhenTheClientCanShowIt() {
        service.update(salonId, List.of(new AreaSetting("BOOKING", true, CheckoutUi.ELEMENTS)), SalonPaymentSettings.BookingPaymentType.FULL, 20);
        when(stripe.post(eq("/v1/checkout/sessions"), any(), anyString(), eq(acct)))
                .thenReturn(Map.of("id", "cs_el_" + salonId, "client_secret", "cs_el_secret"))
                .thenReturn(Map.of("id", "cs_el2_" + salonId, "url", "https://checkout.stripe.com/c/pay/cs_2"));

        var inline = service.createCheckout(salonId, new PaymentGateway.CheckoutRequest("BOOKING", "7", new BigDecimal("40"),
                "DKK", "Cut", "https://book.salonsaas.org/glow", null, true));
        assertThat(inline.ui()).isEqualTo(CheckoutUi.ELEMENTS);
        assertThat(inline.url()).isNull();
        assertThat(inline.clientSecret()).isEqualTo("cs_el_secret");
        assertThat(inline.publishableKey()).isEqualTo("pk_test_flow");
        assertThat(inline.stripeAccountId()).isEqualTo(acct);
        assertThat(inline.cancelUrl()).contains("payment=cancel").contains("session_id=cs_el_" + salonId);
        assertThat(inline.branding().primaryColor()).isEqualTo("#DB2777");
        assertThat(inline.branding().fontFamily()).isEqualTo("Lora");
        var form = sentForm("/v1/checkout/sessions");
        assertThat(form.getFirst("ui_mode")).isEqualTo("elements");
        assertThat(form.getFirst("return_url")).startsWith("https://book.salonsaas.org/glow?payment=success");
        assertThat(form).doesNotContainKeys("success_url", "cancel_url", "branding_settings[display_name]");

        // MCP apps / chat can only open a link: same salon setting, redirect checkout.
        var redirect = service.createCheckout(salonId, new PaymentGateway.CheckoutRequest("BOOKING", "8", new BigDecimal("40"),
                "DKK", "Cut", null, null, false));
        assertThat(redirect.ui()).isEqualTo(CheckoutUi.REDIRECT);
        assertThat(redirect.url()).isNotNull();
    }

    // ── Webhook → ledger → refunds ──────────────────────────────────────────

    @Test void paidCheckoutIsSettledAndCanBeRefundedInPartsFromTheApp() {
        var payment = paidCheckout("SHOP", "51", "30.00");

        assertThat(payment.status()).isEqualTo("SUCCEEDED");
        assertThat(payment.paymentIntentId()).isEqualTo("pi_" + salonId);
        assertThat(events.stream(StripePaymentEvent.class))
                .contains(new StripePaymentEvent(salonId, "SHOP", "51", "cs_paid_51_" + salonId, true));

        when(stripe.post(eq("/v1/refunds"), any(), anyString(), eq(acct)))
                .thenReturn(Map.of("id", "re_a_" + salonId, "status", "succeeded"));
        var refund = refunds.refundPayment(salonId, payment.id(), new BigDecimal("10"), "Damaged", "owner@glow.dk");
        assertThat(refund.amount()).isEqualByComparingTo("10");
        var form = sentForm("/v1/refunds");
        assertThat(form.getFirst("payment_intent")).isEqualTo("pi_" + salonId);
        assertThat(form.getFirst("amount")).isEqualTo("1000");
        assertThat(ledger.find(salonId, payment.id()).orElseThrow().status()).isEqualTo("PARTIALLY_REFUNDED");

        // Never more than what's left.
        assertThatThrownBy(() -> refunds.refundPayment(salonId, payment.id(), new BigDecimal("25"), null, null))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));

        // Stripe reports the refund failed (e.g. closed card): the money counts as not refunded again.
        webhook("refund.failed", Map.of("id", "re_a_" + salonId, "object", "refund", "status", "failed",
                "payment_intent", "pi_" + salonId, "amount", 1000));
        var after = ledger.find(salonId, payment.id()).orElseThrow();
        assertThat(after.status()).isEqualTo("SUCCEEDED");
        assertThat(after.amountRefunded()).isEqualByComparingTo("0");
    }

    @Test void refundMadeInStripesEmbeddedComponentIsAddedToTheLedger() {
        var payment = paidCheckout("BOOKING", "61", "20.00");
        webhook("refund.created", Map.of("id", "re_ext_" + salonId, "object", "refund", "status", "succeeded",
                "payment_intent", "pi_" + salonId, "amount", 2000));
        var after = ledger.find(salonId, payment.id()).orElseThrow();
        assertThat(after.status()).isEqualTo("REFUNDED");
        assertThat(ledger.refunds(salonId, payment.id())).singleElement()
                .satisfies(r -> assertThat(r.requestedBy()).isEqualTo("stripe"));
    }

    @Test void refundIfPaidIsEmptyWhenNothingWasPaidByCard() {
        assertThat(service.refundIfPaid(salonId, "SHOP", "999", null, null, "admin")).isEmpty();
    }

    // ── Card readers ────────────────────────────────────────────────────────

    @Test void readerPaymentSettlesOnceFromTheWebhook() {
        service.update(salonId, List.of(new AreaSetting("POS", true, CheckoutUi.REDIRECT)), SalonPaymentSettings.BookingPaymentType.FULL, 20);
        var terminal = registerReader();
        assertThat(terminals.list(salonId)).extracting(StripeTerminalService.TerminalView::label).containsExactly("Front desk");
        var location = sentForm("/v1/terminal/locations");
        assertThat(location.getFirst("address[line1]")).isEqualTo("Main St 1");
        assertThat(location.getFirst("address[country]")).isEqualTo("DK");

        var intentId = "pi_term_" + salonId;
        when(stripe.post(eq("/v1/payment_intents"), any(), anyString(), eq(acct))).thenReturn(Map.of("id", intentId));
        var started = service.collectOnTerminal(salonId, "POS", "77", new BigDecimal("45.00"), "DKK", "Salon purchase", terminal.id());

        assertThat(started.status()).isEqualTo("PENDING");
        assertThat(started.terminalLabel()).isEqualTo("Front desk");
        var intent = sentForm("/v1/payment_intents");
        assertThat(intent.get("allowed_payment_method_types[]")).containsExactly("card_present");
        assertThat(intent.getFirst("amount")).isEqualTo("4500");
        assertThat(intent.getFirst("metadata[payment_channel]")).isEqualTo("TERMINAL");
        verify(stripe).post(eq("/v1/terminal/readers/tmr_" + salonId + "/process_payment_intent"), any(), isNull(), eq(acct));

        // Declined card: kept open for another card.
        webhook("terminal.reader.action_failed", Map.of("id", "tmr_" + salonId, "object", "terminal.reader",
                "action", Map.of("status", "failed", "failure_code", "card_declined", "failure_message", "Insufficient funds",
                        "process_payment_intent", Map.of("payment_intent", intentId))));
        var declined = terminals.status(salonId, started.paymentId(), false);
        assertThat(declined.status()).isEqualTo("PENDING");
        assertThat(declined.failureMessage()).startsWith("Card declined");

        var succeeded = Map.<String, Object>of("id", intentId, "object", "payment_intent", "status", "succeeded",
                "metadata", Map.of("salon_id", salonId.toString(), "payment_area", "POS", "payment_reference", "77",
                        "payment_channel", "TERMINAL"));
        webhook("payment_intent.succeeded", succeeded);
        webhook("payment_intent.succeeded", succeeded);

        assertThat(terminals.status(salonId, started.paymentId(), false).status()).isEqualTo("SUCCEEDED");
        assertThat(events.stream(StripePaymentEvent.class).filter(e -> e.reference().equals("77")))
                .containsExactly(new StripePaymentEvent(salonId, "POS", "77", intentId, true));
    }

    @Test void deskCancelStopsTheReaderAndReportsTheFailure() {
        service.update(salonId, List.of(new AreaSetting("MEMBERSHIP", true, CheckoutUi.REDIRECT)), SalonPaymentSettings.BookingPaymentType.FULL, 20);
        var terminal = registerReader();
        var intentId = "pi_cancel_" + salonId;
        when(stripe.post(eq("/v1/payment_intents"), any(), anyString(), eq(acct))).thenReturn(Map.of("id", intentId));
        var started = service.collectOnTerminal(salonId, "MEMBERSHIP", "88", new BigDecimal("300"), "DKK", "Gold", terminal.id());

        var canceled = terminals.cancel(salonId, started.paymentId());

        assertThat(canceled.status()).isEqualTo("CANCELED");
        verify(stripe).post(eq("/v1/terminal/readers/tmr_" + salonId + "/cancel_action"), any(), isNull(), eq(acct));
        verify(stripe).post(eq("/v1/payment_intents/" + intentId + "/cancel"), any(), isNull(), eq(acct));
        assertThat(events.stream(StripePaymentEvent.class).filter(e -> e.reference().equals("88")))
                .containsExactly(new StripePaymentEvent(salonId, "MEMBERSHIP", "88", intentId, false));
        assertThatThrownBy(() -> terminals.cancel(salonId, started.paymentId()))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private StripeTerminalService.TerminalView registerReader() {
        when(stripe.post(eq("/v1/terminal/locations"), any(), anyString(), eq(acct))).thenReturn(Map.of("id", "tml_" + salonId));
        when(stripe.post(eq("/v1/terminal/readers"), any(), isNull(), eq(acct))).thenReturn(Map.of(
                "id", "tmr_" + salonId, "label", "Front desk", "device_type", "simulated_wisepos_e",
                "serial_number", "SIM-1", "status", "online"));
        return terminals.register(salonApi.findById(salonId).orElseThrow(), "simulated-wpe", "Front desk");
    }

    private PaymentLedger.PaymentRecord paidCheckout(String area, String reference, String amount) {
        service.update(salonId, List.of(new AreaSetting(area, true, CheckoutUi.REDIRECT)), SalonPaymentSettings.BookingPaymentType.FULL, 20);
        var sessionId = "cs_paid_" + reference + "_" + salonId;
        when(stripe.post(eq("/v1/checkout/sessions"), any(), anyString(), eq(acct)))
                .thenReturn(Map.of("id", sessionId, "url", "https://checkout.stripe.com/x"));
        service.createCheckout(salonId, new PaymentGateway.CheckoutRequest(area, reference, new BigDecimal(amount), "DKK",
                "Item", null, null, false));
        webhook("checkout.session.completed", Map.of("id", sessionId, "object", "checkout.session", "payment_status", "paid",
                "payment_intent", "pi_" + salonId,
                "metadata", Map.of("salon_id", salonId.toString(), "payment_area", area, "payment_reference", reference)));
        return ledger.findBySession(sessionId).orElseThrow();
    }

    @SuppressWarnings("unchecked")
    private MultiValueMap<String, String> sentForm(String path) {
        ArgumentCaptor<MultiValueMap<String, String>> form = ArgumentCaptor.forClass(MultiValueMap.class);
        verify(stripe, atLeastOnce()).post(eq(path), form.capture(), any(), any());
        return form.getValue();
    }

    private void webhook(String type, Map<String, Object> object) {
        try {
            var payload = new tools.jackson.databind.ObjectMapper().writeValueAsString(
                    Map.of("type", type, "account", acct, "data", Map.of("object", object)));
            var timestamp = Long.toString(Instant.now().getEpochSecond());
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec("whsec_flow".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            var signature = HexFormat.of().formatHex(mac.doFinal((timestamp + "." + payload).getBytes(StandardCharsets.UTF_8)));
            service.handleWebhook(payload, "t=" + timestamp + ",v1=" + signature);
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
