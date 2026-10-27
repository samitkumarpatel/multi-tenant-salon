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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.util.MultiValueMap;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import com.jayway.jsonpath.JsonPath;
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
    @Autowired WebApplicationContext context;

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

    // ── Payment links (collecting what the salon is owed) ───────────────────

    /** The Payments tab's "Online bookings" switch is about customers paying when they book — not about chasing a no-show. */
    @Test void aPaymentLinkNeedsAReadyStripeAccountButNotTheBookingSwitch() {
        assertThat(service.settings(salonId).area("BOOKING").enabled()).as("online booking payment is off by default").isFalse();
        var request = new PaymentGateway.CheckoutRequest("BOOKING", "9", new BigDecimal("700"), "DKK",
                "Appointment payment — Cut", null, "eva@example.com", true);

        // Taking payment at booking time still follows the switch...
        assertThatThrownBy(() -> service.createCheckout(salonId, request))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
        // ...a payment link does not, and is always a redirect even when the area is set to an in-page style.
        service.update(salonId, List.of(new AreaSetting("BOOKING", false, CheckoutUi.ELEMENTS)), SalonPaymentSettings.BookingPaymentType.FULL, 20);
        var sessionId = "cs_link_9_" + salonId;
        when(stripe.post(eq("/v1/checkout/sessions"), any(), anyString(), eq(acct)))
                .thenReturn(Map.of("id", sessionId, "url", "https://checkout.stripe.com/c/pay/link"));
        var link = service.createPaymentLink(salonId, request);
        assertThat(link.sessionId()).isEqualTo(sessionId);
        assertThat(link.url()).isEqualTo("https://checkout.stripe.com/c/pay/link");
        assertThat(sentForm("/v1/checkout/sessions").getFirst("ui_mode")).isEqualTo("hosted_page");
        assertThat(ledger.findBySession(sessionId).orElseThrow().status()).isEqualTo("PENDING");

        // Paying it settles the booking's payment like any other checkout: the booking module gets the event.
        webhook("checkout.session.completed", Map.of("id", sessionId, "object", "checkout.session", "payment_status", "paid",
                "payment_intent", "pi_" + salonId,
                "metadata", Map.of("salon_id", salonId.toString(), "payment_area", "BOOKING", "payment_reference", "9")));
        assertThat(events.stream(StripePaymentEvent.class)).contains(new StripePaymentEvent(salonId, "BOOKING", "9", sessionId, true));
    }

    @Test void aPaymentLinkStillNeedsAStripeAccountThatCanTakeCharges() {
        var unconnected = UUID.randomUUID();
        jdbc.update("INSERT INTO salon(id, name, handler, address, city, zip_code, country, created_at)"
                + " VALUES (?, 'No Stripe', ?, 'Main St 1', 'Copenhagen', '2100', 'Denmark', now())", unconnected, "nostripe-" + unconnected);
        assertThatThrownBy(() -> service.createPaymentLink(unconnected, new PaymentGateway.CheckoutRequest("BOOKING", "1",
                new BigDecimal("50"), "DKK", "Cut", null, null, false)))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getReason()).contains("Connect your Stripe account");
                });
        assertThatThrownBy(() -> service.createPaymentLink(salonId, new PaymentGateway.CheckoutRequest("NOT_AN_AREA", "1",
                new BigDecimal("50"), "DKK", "Cut", null, null, false))).isInstanceOf(ResponseStatusException.class);
    }

    /** The whole endpoint: a no-show is charged its fee with the Booking switch off, and a missing Stripe account changes nothing. */
    @Test void theNoShowPaymentLinkEndpointWorksWithoutTheBookingSwitch() {
        var client = RestTestClient.bindToApplicationContext(context).build();
        long serviceId = jdbc.queryForObject("INSERT INTO service_item (salon_id, name, category, price, currency, duration_minutes, active, created_at) "
                + "VALUES (?, 'Cut', 'HAIR', 700, 'DKK', 60, true, now()) RETURNING id", Long.class, salonId);
        long staffId = jdbc.queryForObject("INSERT INTO staff_member (salon_id, name, role, status, created_at) "
                + "VALUES (?, 'Sam', 'STYLIST', 'ACTIVE', now()) RETURNING id", Long.class, salonId);
        long noShow = jdbc.queryForObject("INSERT INTO booking (salon_id, service_id, staff_id, customer_name, customer_email, customer_phone, appointment_date, "
                + "start_time, end_time, status, created_at) VALUES (?, ?, ?, 'Jane Smith', 'jane@example.com', '+4500000000', current_date - 1, '10:00', '11:00', 'NO_SHOW', now()) RETURNING id",
                Long.class, salonId, serviceId, staffId);
        assertThat(service.settings(salonId).area("BOOKING").enabled()).isFalse();
        when(stripe.post(eq("/v1/checkout/sessions"), any(), anyString(), eq(acct)))
                .thenReturn(Map.of("id", "cs_ns_" + salonId, "url", "https://checkout.stripe.com/c/pay/ns"));

        var created = client.post().uri("/api/salon-admin/{s}/booking/{b}/payment-link", salonId, noShow).contentType(MediaType.APPLICATION_JSON)
                .body("{\"amount\":700,\"sendEmail\":false}").exchange();
        created.expectStatus().isOk();
        assertThat(created.returnResult(String.class).getResponseBody()).contains("https://checkout.stripe.com/c/pay/ns");
        assertThat(jdbc.queryForObject("SELECT payment_status FROM booking WHERE id = ?", String.class, noShow)).isEqualTo("PENDING");

        // No connected account: a clear 409, and the booking's payment status is put back.
        var unconnected = UUID.randomUUID();
        jdbc.update("INSERT INTO salon(id, name, handler, address, city, zip_code, country, created_at)"
                + " VALUES (?, 'No Stripe', ?, 'Main St 1', 'Copenhagen', '2100', 'Denmark', now())", unconnected, "nostripe-" + unconnected);
        long otherService = jdbc.queryForObject("INSERT INTO service_item (salon_id, name, category, price, currency, duration_minutes, active, created_at) "
                + "VALUES (?, 'Cut', 'HAIR', 700, 'DKK', 60, true, now()) RETURNING id", Long.class, unconnected);
        long otherStaff = jdbc.queryForObject("INSERT INTO staff_member (salon_id, name, role, status, created_at) "
                + "VALUES (?, 'Sam', 'STYLIST', 'ACTIVE', now()) RETURNING id", Long.class, unconnected);
        long other = jdbc.queryForObject("INSERT INTO booking (salon_id, service_id, staff_id, customer_name, customer_email, customer_phone, appointment_date, "
                + "start_time, end_time, status, created_at) VALUES (?, ?, ?, 'Jane Smith', 'jane@example.com', '+4500000000', current_date - 1, '10:00', '11:00', 'NO_SHOW', now()) RETURNING id",
                Long.class, unconnected, otherService, otherStaff);
        var before = jdbc.queryForObject("SELECT payment_status FROM booking WHERE id = ?", String.class, other);
        var refused = client.post().uri("/api/salon-admin/{s}/booking/{b}/payment-link", unconnected, other).contentType(MediaType.APPLICATION_JSON)
                .body("{\"sendEmail\":false}").exchange();
        refused.expectStatus().isEqualTo(409);
        assertThat(refused.returnResult(String.class).getResponseBody()).contains("Connect your Stripe account");
        assertThat(jdbc.queryForObject("SELECT payment_status FROM booking WHERE id = ?", String.class, other)).isEqualTo(before);
    }

    // ── Following up on payment links ───────────────────────────────────────

    @Test void sentPaymentLinksAreKeptSoTheSalonCanFollowUp() throws Exception {
        var client = RestTestClient.bindToApplicationContext(context).build();
        long booking = noShowBooking(salonId);
        stubSessions("cs_a_" + salonId, "cs_b_" + salonId);

        // First link, emailed: recorded with who sent it, to whom, and when it lapses.
        var first = createLink(client, salonId, booking, true);
        assertThat(JsonPath.<String>read(first, "$.link.status")).isEqualTo("OPEN");
        assertThat(JsonPath.<String>read(first, "$.link.emailedTo")).isEqualTo("jane@example.com");
        assertThat(JsonPath.<Integer>read(first, "$.link.emailCount")).isEqualTo(1);
        assertThat(JsonPath.<String>read(first, "$.link.url")).isEqualTo("https://checkout.stripe.com/c/pay/cs_a_" + salonId);
        long firstId = JsonPath.<Number>read(first, "$.link.id").longValue();
        assertThat(JsonPath.<List<?>>read(get(client, salonId, "/booking/payment-links?status=OPEN"), "$")).hasSize(1);
        assertThat(JsonPath.<String>read(get(client, salonId, "/booking/payment-links?status=OPEN"), "$[0].customerName")).isEqualTo("Jane Smith");

        // Sending it again is refused at once (a double click), allowed a minute later, and counted.
        client.post().uri("/api/salon-admin/{s}/booking/{b}/payment-links/{l}/resend", salonId, booking, firstId).exchange().expectStatus().isEqualTo(409);
        jdbc.update("UPDATE booking_payment_link SET last_emailed_at = now() - interval '5 minutes' WHERE id = ?", firstId);
        client.post().uri("/api/salon-admin/{s}/booking/{b}/payment-links/{l}/resend", salonId, booking, firstId).exchange().expectStatus().isOk();
        assertThat(jdbc.queryForObject("SELECT email_count FROM booking_payment_link WHERE id = ?", Integer.class, firstId)).isEqualTo(2);

        // A new link replaces the old: only one is open, and the old session is closed at Stripe.
        var second = createLink(client, salonId, booking, false);
        assertThat(JsonPath.<String>read(second, "$.link.status")).isEqualTo("OPEN");
        var history = get(client, salonId, "/booking/" + booking + "/payment-links");
        assertThat(JsonPath.<List<String>>read(history, "$[*].status")).containsExactly("OPEN", "SUPERSEDED");
        verify(stripe).post(eq("/v1/checkout/sessions/cs_a_" + salonId + "/expire"), any(), anyString(), eq(acct));
        client.post().uri("/api/salon-admin/{s}/booking/{b}/payment-links/{l}/resend", salonId, booking, firstId).exchange().expectStatus().isEqualTo(409);

        // The old session ending says nothing about the appointment: the new link is the one in play.
        webhook("checkout.session.expired", Map.of("id", "cs_a_" + salonId, "object", "checkout.session",
                "metadata", Map.of("salon_id", salonId.toString(), "payment_area", "BOOKING", "payment_reference", String.valueOf(booking))));
        org.awaitility.Awaitility.await().during(java.time.Duration.ofSeconds(2)).atMost(java.time.Duration.ofSeconds(8)).untilAsserted(() -> {
            assertThat(jdbc.queryForObject("SELECT payment_status FROM booking WHERE id = ?", String.class, booking)).isEqualTo("PENDING");
            assertThat(JsonPath.<List<String>>read(get(client, salonId, "/booking/" + booking + "/payment-links"), "$[*].status")).containsExactly("OPEN", "SUPERSEDED");
        });

        // Paying the current link settles the appointment and the link.
        webhook("checkout.session.completed", Map.of("id", "cs_b_" + salonId, "object", "checkout.session", "payment_status", "paid",
                "payment_intent", "pi_" + salonId,
                "metadata", Map.of("salon_id", salonId.toString(), "payment_area", "BOOKING", "payment_reference", String.valueOf(booking))));
        org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(15)).untilAsserted(() -> {
            assertThat(jdbc.queryForObject("SELECT payment_status FROM booking WHERE id = ?", String.class, booking)).isEqualTo("PAID");
            assertThat(JsonPath.<List<?>>read(get(client, salonId, "/booking/payment-links?status=PAID"), "$")).hasSize(1);
        });
        assertThat(JsonPath.<List<?>>read(get(client, salonId, "/booking/payment-links?status=OPEN"), "$")).isEmpty();
        assertThat(JsonPath.<String>read(get(client, salonId, "/booking/payment-links?status=PAID"), "$[0].link.paidAt")).isNotBlank();
        // The no-show itself is left as it was.
        assertThat(jdbc.queryForObject("SELECT status FROM booking WHERE id = ?", String.class, booking)).isEqualTo("NO_SHOW");
    }

    @Test void aLapsedOrFailedLinkReadsAsExpiredAndNeedsANewOne() throws Exception {
        var client = RestTestClient.bindToApplicationContext(context).build();
        long timedOut = noShowBooking(salonId);
        long failed = noShowBooking(salonId);
        stubSessions("cs_t_" + salonId, "cs_f_" + salonId);
        var lapsed = createLink(client, salonId, timedOut, false);
        createLink(client, salonId, failed, false);

        // Past its 24 hours it reads as expired without waiting for Stripe, and can no longer be re-sent.
        jdbc.update("UPDATE booking_payment_link SET expires_at = now() - interval '1 minute' WHERE booking_id = ?", timedOut);
        assertThat(JsonPath.<List<Integer>>read(get(client, salonId, "/booking/payment-links?status=EXPIRED"), "$[*].link.bookingId"))
                .containsExactly((int) timedOut);
        client.post().uri("/api/salon-admin/{s}/booking/{b}/payment-links/{l}/resend", salonId, timedOut,
                JsonPath.<Number>read(lapsed, "$.link.id").longValue()).exchange().expectStatus().isEqualTo(409);

        // Stripe reporting the current link failed closes it and the appointment's payment, so a new link can be sent.
        webhook("checkout.session.expired", Map.of("id", "cs_f_" + salonId, "object", "checkout.session",
                "metadata", Map.of("salon_id", salonId.toString(), "payment_area", "BOOKING", "payment_reference", String.valueOf(failed))));
        org.awaitility.Awaitility.await().atMost(java.time.Duration.ofSeconds(15)).untilAsserted(() -> {
            assertThat(jdbc.queryForObject("SELECT payment_status FROM booking WHERE id = ?", String.class, failed)).isEqualTo("FAILED");
            assertThat(JsonPath.<List<?>>read(get(client, salonId, "/booking/payment-links?status=EXPIRED"), "$")).hasSize(2);
        });
        assertThat(JsonPath.<List<?>>read(get(client, salonId, "/booking/payment-links?status=OPEN"), "$")).isEmpty();
        client.get().uri("/api/salon-admin/{s}/booking/payment-links?status=nope", salonId).exchange().expectStatus().isBadRequest();
    }

    @Test void oneSalonNeverSeesAnotherSalonsPaymentLinks() throws Exception {
        var client = RestTestClient.bindToApplicationContext(context).build();
        long booking = noShowBooking(salonId);
        stubSessions("cs_iso_" + salonId);
        createLink(client, salonId, booking, false);

        var other = UUID.randomUUID();
        jdbc.update("INSERT INTO salon(id, name, handler, address, city, zip_code, country, created_at)"
                + " VALUES (?, 'Other', ?, 'Main St 1', 'Copenhagen', '2100', 'Denmark', now())", other, "other-" + other);
        assertThat(JsonPath.<List<?>>read(get(client, other, "/booking/payment-links"), "$")).isEmpty();
        client.get().uri("/api/salon-admin/{s}/booking/{b}/payment-links", other, booking).exchange().expectStatus().isNotFound();
        var linkId = jdbc.queryForObject("SELECT id FROM booking_payment_link WHERE booking_id = ?", Long.class, booking);
        client.post().uri("/api/salon-admin/{s}/booking/{b}/payment-links/{l}/resend", other, booking, linkId).exchange().expectStatus().isNotFound();
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

    private long noShowBooking(UUID salon) {
        long serviceId = jdbc.queryForObject("INSERT INTO service_item (salon_id, name, category, price, currency, duration_minutes, active, created_at) "
                + "VALUES (?, 'Cut', 'HAIR', 700, 'DKK', 60, true, now()) RETURNING id", Long.class, salon);
        long staffId = jdbc.queryForObject("INSERT INTO staff_member (salon_id, name, role, status, created_at) "
                + "VALUES (?, 'Sam', 'STYLIST', 'ACTIVE', now()) RETURNING id", Long.class, salon);
        return jdbc.queryForObject("INSERT INTO booking (salon_id, service_id, staff_id, customer_name, customer_email, customer_phone, appointment_date, "
                + "start_time, end_time, status, created_at) VALUES (?, ?, ?, 'Jane Smith', 'jane@example.com', '+4500000000', current_date - 1, '10:00', '11:00', 'NO_SHOW', now()) RETURNING id",
                Long.class, salon, serviceId, staffId);
    }

    /** Stripe answers each new checkout session with the next id, and a real-looking page. */
    private void stubSessions(String... ids) {
        var answers = java.util.Arrays.stream(ids).map(id -> (Map<String, Object>) Map.<String, Object>of("id", id, "url", "https://checkout.stripe.com/c/pay/" + id)).toList();
        var stub = when(stripe.post(eq("/v1/checkout/sessions"), any(), anyString(), eq(acct)));
        var chained = stub.thenReturn(answers.get(0));
        for (int i = 1; i < answers.size(); i++) chained = chained.thenReturn(answers.get(i));
    }

    private String createLink(RestTestClient client, UUID salon, long booking, boolean email) {
        var result = client.post().uri("/api/salon-admin/{s}/booking/{b}/payment-link", salon, booking).contentType(MediaType.APPLICATION_JSON)
                .body("{\"amount\":700,\"sendEmail\":" + email + "}").exchange();
        result.expectStatus().isOk();
        return result.returnResult(String.class).getResponseBody();
    }

    private String get(RestTestClient client, UUID salon, String path) {
        var result = client.get().uri("/api/salon-admin/" + salon + path).exchange();
        result.expectStatus().isOk();
        return result.returnResult(String.class).getResponseBody();
    }

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
