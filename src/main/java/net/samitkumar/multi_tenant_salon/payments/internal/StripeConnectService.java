package net.samitkumar.multi_tenant_salon.payments.internal;

import net.samitkumar.multi_tenant_salon.payments.SalonPaymentSettings;
import net.samitkumar.multi_tenant_salon.payments.PaymentGateway;
import net.samitkumar.multi_tenant_salon.payments.StripeConnectedAccount;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.utility.CountryApi;
import net.samitkumar.multi_tenant_salon.website.WebsiteDomainApi;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.web.util.UriComponentsBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import net.samitkumar.multi_tenant_salon.payments.StripePaymentEvent;
import org.springframework.context.ApplicationEventPublisher;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.security.MessageDigest;
import java.time.Duration;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.UUID;
import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class StripeConnectService implements PaymentGateway {
    record Status(StripeConnectedAccount account, SalonPaymentSettings settings, boolean configured) {}

    private final StripeConnectedAccountRepository accounts;
    private final SalonPaymentSettingsRepository settings;
    private final SalonApi salons;
    private final CountryApi countries;
    private final RestClient stripe;
    private final String secretKey;
    private final String adminAppUrl;
    private final String dashboardAppUrl;
    private final String webhookSecret;
    private final ApplicationEventPublisher events;
    private final String bookingAppUrl;
    private final String websiteAppUrl;
    private final String salonDomain;
    private final JdbcClient jdbc;
    private final ObjectProvider<WebsiteDomainApi> domains;
    private final String apiVersion;

    StripeConnectService(StripeConnectedAccountRepository accounts, SalonPaymentSettingsRepository settings,
                         SalonApi salons, CountryApi countries, RestClient.Builder clientBuilder,
                         @Value("${spring.application.payments.stripe-secret-key:}") String secretKey,
                         @Value("${spring.application.payments.admin-app-url}") String adminAppUrl,
                         @Value("${spring.application.payments.dashboard-app-url:https://dashboard.salonsaas.org}") String dashboardAppUrl,
                         @Value("${spring.application.payments.stripe-webhook-secret:}") String webhookSecret,
                         @Value("${spring.application.payments.booking-app-url}") String bookingAppUrl,
                         @Value("${spring.application.payments.website-app-url:}") String websiteAppUrl,
                         @Value("${spring.application.payments.salon-domain:salonsaas.org}") String salonDomain,
                         ApplicationEventPublisher events, JdbcTemplate jdbcTemplate,
                         ObjectProvider<WebsiteDomainApi> domains,
                         @Value("${spring.application.payments.stripe-api-version:2026-08-26.dahlia}") String apiVersion) {
        this.accounts = accounts;
        this.settings = settings;
        this.salons = salons;
        this.countries = countries;
        this.stripe = clientBuilder.baseUrl("https://api.stripe.com").build();
        this.secretKey = secretKey;
        this.adminAppUrl = adminAppUrl.replaceAll("/$", "");
        this.dashboardAppUrl = dashboardAppUrl.replaceAll("/$", "");
        this.webhookSecret = webhookSecret;
        this.events = events;
        this.bookingAppUrl = bookingAppUrl.replaceAll("/$", "");
        this.websiteAppUrl = websiteAppUrl.replaceAll("/$", "");
        this.salonDomain = salonDomain;
        this.jdbc = JdbcClient.create(jdbcTemplate);
        this.domains = domains;
        this.apiVersion = apiVersion;
    }

    Status status(UUID salonId) {
        var salon = requireSalon(salonId);
        var account = accounts.findById(salonId).orElse(null);
        if (account != null && configured()) account = refresh(account);
        return new Status(account, settings.findById(salonId).orElseGet(() -> defaults(salon)), configured());
    }

    String onboardingUrl(UUID salonId) {
        var salon = requireSalon(salonId);
        requireStripe();
        var account = accounts.findById(salonId).orElseGet(() -> createAccount(salon));
        var body = Map.<String, Object>of(
                "account", account.stripeAccountId(),
                "use_case", Map.of(
                        "type", "account_onboarding",
                        "account_onboarding", Map.of(
                                "configurations", List.of("merchant"),
                                "return_url", adminAppUrl + "/" + salonId + "/payments?stripe=return",
                                "refresh_url", adminAppUrl + "/" + salonId + "/payments?stripe=refresh")));
        var response = postV2("/v2/core/account_links", body, null);
        return (String) response.get("url");
    }

    SalonPaymentSettings update(UUID salonId, boolean shop, boolean booking, boolean pos,
                                SalonPaymentSettings.BookingPaymentType bookingType, int depositPercent) {
        var salon = requireSalon(salonId);
        if ((shop && !hasFeature(salon, SalonFeature.WEBSHOP)) || (booking && !hasFeature(salon, SalonFeature.BOOKING))
                || (pos && !hasFeature(salon, SalonFeature.DASHBOARD))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Enable the related salon feature first");
        }
        if ((shop || booking || pos) && !isReady(salonId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Complete Stripe onboarding before enabling payments");
        }
        if (depositPercent < 1 || depositPercent > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Deposit percentage must be between 1 and 100");
        }
        var saved = new SalonPaymentSettings(salonId, shop, booking, pos, bookingType, depositPercent, Instant.now());
        jdbc.sql("INSERT INTO salon_payment_settings (salon_id, shop_enabled, booking_enabled, pos_enabled, booking_payment_type, booking_deposit_percent, updated_at) VALUES (:id, :shop, :booking, :pos, :type, :deposit, :updated) ON CONFLICT (salon_id) DO UPDATE SET shop_enabled = EXCLUDED.shop_enabled, booking_enabled = EXCLUDED.booking_enabled, pos_enabled = EXCLUDED.pos_enabled, booking_payment_type = EXCLUDED.booking_payment_type, booking_deposit_percent = EXCLUDED.booking_deposit_percent, updated_at = EXCLUDED.updated_at")
                .param("id", salonId).param("shop", shop).param("booking", booking).param("pos", pos)
                .param("type", bookingType.name()).param("deposit", depositPercent).param("updated", saved.updatedAt()).update();
        return saved;
    }

    boolean isReady(UUID salonId) {
        var account = accounts.findById(salonId).orElse(null);
        if (account == null || !secretConfigured() || webhookSecret == null || webhookSecret.isBlank()) return false;
        account = refresh(account);
        return account.detailsSubmitted() && account.chargesEnabled();
    }

    @Override public boolean enabled(UUID salonId, String area) {
        var config = settings.findById(salonId).orElse(null);
        if (config == null) return false;
        return switch (area) {
            case "SHOP" -> config.shopEnabled();
            case "BOOKING" -> config.bookingEnabled();
            case "POS" -> config.posEnabled();
            default -> false;
        };
    }

    @Override public PaymentGateway.BookingConfig bookingConfig(UUID salonId) {
        var config = settings.findById(salonId).orElse(null);
        return config == null ? new PaymentGateway.BookingConfig(false, SalonPaymentSettings.BookingPaymentType.FULL, 20)
                : new PaymentGateway.BookingConfig(config.bookingEnabled(), config.bookingPaymentType(), config.bookingDepositPercent());
    }

    @Override public void requireEnabled(UUID salonId, String area) {
        if (!enabled(salonId, area) || !isReady(salonId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Stripe payments are not enabled for this salon");
        }
    }

    @Override public String createCheckout(UUID salonId, String area, String reference, BigDecimal amount, String currency,
                                           String itemName, String returnUrl) {
        requireEnabled(salonId, area);
        if (amount == null || amount.signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A positive price is required to accept online payment");
        }
        var account = accounts.findById(salonId).orElseThrow();
        var minorUnits = amount.movePointRight(currencyExponent(currency))
                .setScale(0, RoundingMode.HALF_UP).longValueExact();
        var salon = salons.findById(salonId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Salon not found"));
        var returnPage = returnPage(salon, area, returnUrl);
        var form = new LinkedMultiValueMap<String, String>();
        form.add("mode", "payment");
        form.add("success_url", paymentReturn(returnPage, "success", reference));
        form.add("cancel_url", paymentReturn(returnPage, "cancel", reference));
        form.add("client_reference_id", area + ":" + reference);
        form.add("line_items[0][price_data][currency]", currency.toLowerCase(Locale.ROOT));
        form.add("line_items[0][price_data][unit_amount]", Long.toString(minorUnits));
        form.add("line_items[0][price_data][product_data][name]", itemName);
        form.add("line_items[0][quantity]", "1");
        form.add("metadata[salon_id]", salonId.toString());
        form.add("metadata[payment_area]", area);
        form.add("metadata[payment_reference]", reference);
        var response = post("/v1/checkout/sessions", form, "checkout-" + area.toLowerCase(Locale.ROOT) + "-" + reference,
                account.stripeAccountId());
        return (String) response.get("url");
    }

    /**
     * The page Stripe sends the customer back to. The customer's own page (so the per-origin
     * sessionStorage hand-off survives, e.g. on a connected custom domain) is used only when its origin
     * belongs to this salon; anything else falls back to the area default, so this is never an open redirect.
     */
    String returnPage(Salon salon, String area, String returnUrl) {
        var requested = "POS".equals(area) ? null : allowedReturnPage(salon, returnUrl);
        if (requested != null) return requested;
        return switch (area) {
            case "SHOP" -> websiteAppUrl.isBlank()
                    ? "https://" + salon.handler() + "." + salonDomain + "/"
                    : websiteAppUrl + "/?slug=" + salon.handler();
            case "BOOKING" -> bookingAppUrl + "/" + salon.handler();
            default -> dashboardAppUrl + "/" + salon.id() + "?view=cashier&cashierView=pos";
        };
    }

    private String allowedReturnPage(Salon salon, String returnUrl) {
        if (returnUrl == null || returnUrl.isBlank()) return null;
        try {
            var uri = URI.create(returnUrl.trim());
            var origin = origin(uri);
            if (origin == null) return null;
            boolean allowed = origin.equals(origin(websiteAppUrl)) || origin.equals(origin(bookingAppUrl))
                    || origin.equals("https://" + salon.handler().toLowerCase(Locale.ROOT) + "." + salonDomain.toLowerCase(Locale.ROOT))
                    || isActiveCustomDomain(salon.id(), origin);
            if (!allowed) return null;
            return UriComponentsBuilder.fromUri(uri).fragment(null)
                    .replaceQueryParam("payment").replaceQueryParam("reference").replaceQueryParam("session_id")
                    .build().toUriString();
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private boolean isActiveCustomDomain(UUID salonId, String origin) {
        // Isolated Modulith contexts may omit the website module; then only platform hosts are accepted.
        var api = domains.getIfAvailable();
        return api != null && api.isActiveOriginFor(salonId, origin);
    }

    private static String origin(String url) {
        if (url == null || url.isBlank()) return null;
        try { return origin(URI.create(url)); } catch (IllegalArgumentException e) { return null; }
    }

    private static String origin(URI uri) {
        var scheme = uri.getScheme() == null ? null : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!"https".equals(scheme) && !"http".equals(scheme)) return null;
        if (uri.getHost() == null || uri.getRawUserInfo() != null) return null;
        int port = uri.getPort();
        boolean defaultPort = port == -1 || ("https".equals(scheme) && port == 443) || ("http".equals(scheme) && port == 80);
        return scheme + "://" + uri.getHost().toLowerCase(Locale.ROOT) + (defaultPort ? "" : ":" + port);
    }

    private static String paymentReturn(String page, String outcome, String reference) {
        // {CHECKOUT_SESSION_ID} is Stripe's template placeholder — appended verbatim, never URI-encoded.
        return UriComponentsBuilder.fromUriString(page).replaceQueryParam("payment", outcome)
                .replaceQueryParam("reference", reference).build().toUriString()
                + "&session_id={CHECKOUT_SESSION_ID}";
    }

    void handleWebhook(String payload, String signature) {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Stripe webhooks are not configured");
        }
        verifySignature(payload, signature);
        try {
            @SuppressWarnings("unchecked") var event = (Map<String, Object>) new tools.jackson.databind.ObjectMapper().readValue(payload, Map.class);
            var type = String.valueOf(event.get("type"));
            if (!type.startsWith("checkout.session.")) return;
            var connectedAccountId = (String) event.get("account");
            if (connectedAccountId == null) return;
            var account = accounts.findByStripeAccountId(connectedAccountId).orElse(null);
            if (account == null) return;
            @SuppressWarnings("unchecked") var data = (Map<String, Object>) event.get("data");
            @SuppressWarnings("unchecked") var object = (Map<String, Object>) data.get("object");
            @SuppressWarnings("unchecked") var metadata = (Map<String, Object>) object.get("metadata");
            if (metadata == null || !account.salonId().toString().equals(metadata.get("salon_id"))) return;
            var area = String.valueOf(metadata.get("payment_area"));
            if (!java.util.Set.of("POS", "SHOP", "BOOKING").contains(area)) return;
            var reference = String.valueOf(metadata.get("payment_reference"));
            var sessionId = String.valueOf(object.get("id"));
            var succeeded = ("checkout.session.completed".equals(type) && "paid".equals(object.get("payment_status")))
                    || "checkout.session.async_payment_succeeded".equals(type);
            var failed = "checkout.session.expired".equals(type) || "checkout.session.async_payment_failed".equals(type);
            if (succeeded || failed) events.publishEvent(new StripePaymentEvent(account.salonId(), area, reference, sessionId, succeeded));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Stripe webhook payload", e);
        }
    }

    private void verifySignature(String payload, String signature) {
        try {
            String timestamp = null;
            var candidates = new java.util.ArrayList<String>();
            for (var part : signature.split(",")) {
                var bits = part.split("=", 2);
                if (bits.length != 2) continue;
                if ("t".equals(bits[0])) timestamp = bits[1];
                if ("v1".equals(bits[0])) candidates.add(bits[1]);
            }
            if (timestamp == null || candidates.isEmpty() || Math.abs(Instant.now().getEpochSecond() - Long.parseLong(timestamp)) > Duration.ofMinutes(5).toSeconds()) {
                throw new IllegalArgumentException("Invalid signature timestamp");
            }
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            var expected = java.util.HexFormat.of().formatHex(mac.doFinal((timestamp + "." + payload).getBytes(StandardCharsets.UTF_8)));
            boolean valid = candidates.stream().anyMatch(candidate -> MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII), candidate.getBytes(StandardCharsets.US_ASCII)));
            if (!valid) throw new IllegalArgumentException("Signature mismatch");
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Stripe webhook signature", e);
        }
    }

    private StripeConnectedAccount createAccount(Salon salon) {
        var countryCode = salon.location() == null ? null : countries.findByName(salon.location().country())
                .map(c -> c.code().toUpperCase()).orElse(null);
        if (countryCode == null || countryCode.length() != 2) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Add a valid salon country before connecting Stripe");
        }
        var response = postV2("/v2/core/accounts", accountRequest(salon, countryCode), "salon-connect-v2-" + salon.id());
        return saveAccount(accountState(salon.id(), countryCode, response));
    }

    /**
     * Accounts v2 connected account for direct charges on the salon's own account: the salon gets the
     * full Stripe Dashboard, Stripe collects its processing fees from the salon and carries negative-balance
     * liability ({@code dashboard: express} would force the platform to pay fees and cover losses).
     * Responsibilities can't be changed once the merchant configuration exists.
     */
    static Map<String, Object> accountRequest(Salon salon, String countryCode) {
        var body = new java.util.LinkedHashMap<String, Object>();
        if (salon.owner() != null && salon.owner().email() != null && !salon.owner().email().isBlank()) {
            body.put("contact_email", salon.owner().email());
        }
        if (salon.name() != null && !salon.name().isBlank()) body.put("display_name", salon.name());
        body.put("identity", Map.of("country", countryCode.toLowerCase(Locale.ROOT)));
        body.put("dashboard", "full");
        body.put("configuration", Map.of("merchant", Map.of("capabilities",
                Map.of("card_payments", Map.of("requested", true)))));
        body.put("defaults", Map.of("responsibilities", Map.of("fees_collector", "stripe", "losses_collector", "stripe")));
        body.put("metadata", Map.of("salon_id", salon.id().toString()));
        body.put("include", List.of("configuration.merchant", "requirements"));
        return body;
    }

    /** Maps a v2 account (with configuration.merchant + requirements included) onto the stored v1-style flags. */
    @SuppressWarnings("unchecked")
    static StripeConnectedAccount accountState(UUID salonId, String country, Map<String, Object> account) {
        var merchant = nested(account, "configuration", "merchant", "capabilities");
        boolean charges = "active".equals(nested(merchant, "card_payments").get("status"));
        boolean payouts = "active".equals(nested(merchant, "stripe_balance", "payouts").get("status"));
        var deadline = nested(account, "requirements", "summary", "minimum_deadline").get("status");
        // Onboarding is "submitted" once nothing is currently/past due; eventually_due items only apply at volume thresholds.
        boolean submitted = account.get("requirements") != null
                && !"currently_due".equals(deadline) && !"past_due".equals(deadline);
        return new StripeConnectedAccount(salonId, (String) account.get("id"), country, submitted, charges, payouts, Instant.now());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> nested(Map<String, Object> map, String... keys) {
        Map<String, Object> current = map == null ? Map.of() : map;
        for (var key : keys) {
            current = current.get(key) instanceof Map<?, ?> next ? (Map<String, Object>) next : Map.of();
        }
        return current;
    }

    private StripeConnectedAccount refresh(StripeConnectedAccount saved) {
        var response = getV2("/v2/core/accounts/" + saved.stripeAccountId()
                + "?include[0]=configuration.merchant&include[1]=requirements");
        return saveAccount(accountState(saved.salonId(), saved.country(), response));
    }

    private StripeConnectedAccount saveAccount(StripeConnectedAccount account) {
        jdbc.sql("INSERT INTO stripe_connected_account (salon_id, stripe_account_id, country, details_submitted, charges_enabled, payouts_enabled, updated_at) VALUES (:salon, :account, :country, :details, :charges, :payouts, :updated) ON CONFLICT (salon_id) DO UPDATE SET stripe_account_id = EXCLUDED.stripe_account_id, country = EXCLUDED.country, details_submitted = EXCLUDED.details_submitted, charges_enabled = EXCLUDED.charges_enabled, payouts_enabled = EXCLUDED.payouts_enabled, updated_at = EXCLUDED.updated_at")
                .param("salon", account.salonId()).param("account", account.stripeAccountId()).param("country", account.country())
                .param("details", account.detailsSubmitted()).param("charges", account.chargesEnabled())
                .param("payouts", account.payoutsEnabled()).param("updated", account.updatedAt()).update();
        return account;
    }

    private Map<String, Object> post(String path, LinkedMultiValueMap<String, String> form, String idempotencyKey, String connectedAccount) {
        requireStripe();
        try {
            var request = stripe.post().uri(path).header("Authorization", "Bearer " + secretKey)
                    .header("Content-Type", "application/x-www-form-urlencoded");
            if (idempotencyKey != null) request.header("Idempotency-Key", idempotencyKey);
            if (connectedAccount != null) request.header("Stripe-Account", connectedAccount);
            return request.body(form).retrieve().body(Map.class);
        } catch (Exception e) {
            throw stripeFailure("Stripe request failed", e);
        }
    }

    private Map<String, Object> postV2(String path, Map<String, Object> body, String idempotencyKey) {
        requireStripe();
        try {
            var request = stripe.post().uri(path).header("Authorization", "Bearer " + secretKey)
                    .header("Stripe-Version", apiVersion).contentType(MediaType.APPLICATION_JSON);
            if (idempotencyKey != null) request.header("Idempotency-Key", idempotencyKey);
            return request.body(body).retrieve().body(Map.class);
        } catch (Exception e) {
            throw stripeFailure("Stripe request failed", e);
        }
    }

    private Map<String, Object> getV2(String pathAndQuery) {
        try {
            return stripe.get().uri(URI.create("https://api.stripe.com" + pathAndQuery))
                    .header("Authorization", "Bearer " + secretKey).header("Stripe-Version", apiVersion)
                    .retrieve().body(Map.class);
        } catch (Exception e) {
            throw stripeFailure("Could not retrieve Stripe account status", e);
        }
    }

    /** Surfaces Stripe's own error message (never the key) so admins see why Stripe refused a request. */
    private static ResponseStatusException stripeFailure(String summary, Exception e) {
        if (e instanceof RestClientResponseException response) {
            try {
                @SuppressWarnings("unchecked") var error = (Map<String, Object>) new tools.jackson.databind.ObjectMapper()
                        .readValue(response.getResponseBodyAsString(), Map.class).get("error");
                if (error != null && error.get("message") instanceof String message && !message.isBlank()) {
                    return new ResponseStatusException(HttpStatus.BAD_GATEWAY, summary + ": " + message, e);
                }
            } catch (RuntimeException ignored) {
                // Fall through to the generic message when Stripe's body isn't the usual error envelope.
            }
        }
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, summary, e);
    }

    private int currencyExponent(String currency) {
        var code = currency.toUpperCase(Locale.ROOT);
        if (java.util.Set.of("BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF").contains(code)) return 0;
        if (java.util.Set.of("BHD", "JOD", "KWD", "OMR", "TND").contains(code)) return 3;
        return 2;
    }

    private SalonPaymentSettings defaults(Salon salon) {
        return new SalonPaymentSettings(salon.id(), false, false, false,
                SalonPaymentSettings.BookingPaymentType.FULL, 20, null);
    }

    private Salon requireSalon(UUID id) {
        return salons.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Salon not found"));
    }

    private boolean configured() { return secretConfigured() && webhookSecret != null && !webhookSecret.isBlank(); }
    private boolean secretConfigured() { return secretKey != null && !secretKey.isBlank(); }
    private void requireStripe() {
        if (!configured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Stripe payments are not configured");
    }
    private boolean hasFeature(Salon salon, SalonFeature feature) {
        return salon.features().stream().anyMatch(f -> f.feature() == feature);
    }
}
