package net.samitkumar.multi_tenant_salon.payments.internal;

import net.samitkumar.multi_tenant_salon.payments.CheckoutUi;
import net.samitkumar.multi_tenant_salon.payments.PaymentGateway;
import net.samitkumar.multi_tenant_salon.payments.SalonPaymentSettings;
import net.samitkumar.multi_tenant_salon.payments.StripeConnectedAccount;
import net.samitkumar.multi_tenant_salon.payments.StripePaymentEvent;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.utility.CountryApi;
import net.samitkumar.multi_tenant_salon.website.WebsiteDomainApi;
import net.samitkumar.multi_tenant_salon.website.WebsiteThemeApi;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class StripeConnectService implements PaymentGateway {
    /**
     * {@code inlineCheckoutAvailable}: the server has a publishable key, so areas can use the embedded or
     * branded form. {@code publishableKey} is what the admin app needs for Stripe's embedded account components.
     */
    record Status(StripeConnectedAccount account, SalonPaymentSettings settings, boolean configured,
                  Onboarding onboarding, boolean testMode, boolean inlineCheckoutAvailable, String publishableKey) {}

    /** Where the salon is in Stripe's onboarding, and what Stripe is still waiting for. */
    record Onboarding(Stage stage, List<Requirement> requirements) {
        enum Stage {
            /** No connected account yet. */
            NOT_STARTED,
            /** Account exists but Stripe still needs information from the salon. */
            ACTION_REQUIRED,
            /** Everything due was submitted; Stripe hasn't activated card payments yet. */
            IN_REVIEW,
            /** Card payments are active. */
            READY
        }
    }

    /** One outstanding Stripe requirement: {@code awaitingActionFrom} is {@code user} or {@code stripe}. */
    record Requirement(String description, String awaitingActionFrom, String deadline) {}

    /** A short-lived session for Stripe's embedded account components (payouts, payments, disputes, …). */
    record AccountSession(String clientSecret, String publishableKey, String stripeAccountId) {}

    /** While onboarding is pending, re-check Stripe at most this often from customer-facing requests. */
    private static final Duration PENDING_ACCOUNT_RECHECK = Duration.ofMinutes(1);
    private static final Pattern HEX_COLOR = Pattern.compile("#[0-9a-fA-F]{6}");
    private static final Pattern EMAIL = Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");
    private static final Set<String> REFUND_EVENTS = Set.of("refund.created", "refund.updated", "refund.failed", "charge.refund.updated");
    private static final Set<String> INTENT_EVENTS = Set.of("payment_intent.succeeded", "payment_intent.canceled", "payment_intent.payment_failed");

    private final StripeConnectedAccountRepository accounts;
    private final SalonApi salons;
    private final CountryApi countries;
    private final StripeClient stripe;
    private final PaymentLedger ledger;
    private final StripeTerminalService terminals;
    private final StripeRefundService refunds;
    private final String adminAppUrl;
    private final String dashboardAppUrl;
    private final String webhookSecret;
    private final ApplicationEventPublisher events;
    private final String bookingAppUrl;
    private final String websiteAppUrl;
    private final String salonDomain;
    private final JdbcClient jdbc;
    private final ObjectProvider<WebsiteDomainApi> domains;
    private final ObjectProvider<WebsiteThemeApi> themes;

    StripeConnectService(StripeConnectedAccountRepository accounts, SalonApi salons, CountryApi countries,
                         StripeClient stripe, PaymentLedger ledger, StripeTerminalService terminals, StripeRefundService refunds,
                         @Value("${spring.application.payments.admin-app-url}") String adminAppUrl,
                         @Value("${spring.application.payments.dashboard-app-url:https://dashboard.salonsaas.org}") String dashboardAppUrl,
                         @Value("${spring.application.payments.stripe-webhook-secret:}") String webhookSecret,
                         @Value("${spring.application.payments.booking-app-url}") String bookingAppUrl,
                         @Value("${spring.application.payments.website-app-url:}") String websiteAppUrl,
                         @Value("${spring.application.payments.salon-domain:salonsaas.org}") String salonDomain,
                         ApplicationEventPublisher events, JdbcTemplate jdbcTemplate,
                         ObjectProvider<WebsiteDomainApi> domains, ObjectProvider<WebsiteThemeApi> themes) {
        this.accounts = accounts;
        this.salons = salons;
        this.countries = countries;
        this.stripe = stripe;
        this.ledger = ledger;
        this.terminals = terminals;
        this.refunds = refunds;
        this.adminAppUrl = adminAppUrl.replaceAll("/$", "");
        this.dashboardAppUrl = dashboardAppUrl.replaceAll("/$", "");
        this.webhookSecret = webhookSecret;
        this.events = events;
        this.bookingAppUrl = bookingAppUrl.replaceAll("/$", "");
        this.websiteAppUrl = websiteAppUrl.replaceAll("/$", "");
        this.salonDomain = salonDomain;
        this.jdbc = JdbcClient.create(jdbcTemplate);
        this.domains = domains;
        this.themes = themes;
    }

    // ── Account & onboarding ────────────────────────────────────────────────

    Status status(UUID salonId) {
        requireSalon(salonId);
        var account = accounts.findById(salonId).orElse(null);
        Map<String, Object> remote = null;
        if (account != null && configured()) {
            remote = fetchAccount(account.stripeAccountId());
            account = saveAccount(accountState(account.salonId(), account.country(), remote));
        }
        return new Status(account, settings(salonId), configured(), onboarding(account, remote), stripe.testMode(),
                stripe.publishableKey() != null, stripe.publishableKey());
    }

    /** Stage from the stored flags; the outstanding requirements only when Stripe's account is at hand. */
    static Onboarding onboarding(StripeConnectedAccount account, Map<String, Object> remote) {
        if (account == null) return new Onboarding(Onboarding.Stage.NOT_STARTED, List.of());
        var requirements = new ArrayList<Requirement>();
        if (nested(remote, "requirements").get("entries") instanceof List<?> entries) {
            for (var item : entries) {
                if (!(item instanceof Map<?, ?> entry)) continue;
                var deadline = entry.get("minimum_deadline") instanceof Map<?, ?> d ? d.get("status") : null;
                // eventually_due items only apply at volume thresholds — not part of getting set up.
                if (!"currently_due".equals(deadline) && !"past_due".equals(deadline)) continue;
                if (!(entry.get("description") instanceof String description) || description.isBlank()) continue;
                requirements.add(new Requirement(description,
                        entry.get("awaiting_action_from") instanceof String from ? from : "user", (String) deadline));
            }
        }
        var stage = account.detailsSubmitted() && account.chargesEnabled() ? Onboarding.Stage.READY
                : account.detailsSubmitted() ? Onboarding.Stage.IN_REVIEW : Onboarding.Stage.ACTION_REQUIRED;
        return new Onboarding(stage, List.copyOf(requirements));
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
        var response = stripe.postV2("/v2/core/account_links", body, null);
        return (String) response.get("url");
    }

    /**
     * An Account Session for Stripe's embedded components, so the owner onboards and manages payouts, payments,
     * refunds and disputes inside the admin app instead of on stripe.com. Creates the connected account first when
     * the salon has none, so onboarding can start in the app too. The salon's account has full Stripe Dashboard
     * access, so Stripe asks the owner to sign in to Stripe inside the component for sensitive screens.
     */
    AccountSession accountSession(UUID salonId) {
        var salon = requireSalon(salonId);
        requireStripe();
        if (stripe.publishableKey() == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Stripe publishable key is not configured");
        }
        var account = accounts.findById(salonId).orElseGet(() -> createAccount(salon));
        var form = new LinkedMultiValueMap<String, String>();
        form.add("account", account.stripeAccountId());
        form.add("components[account_onboarding][enabled]", "true");
        form.add("components[account_management][enabled]", "true");
        form.add("components[notification_banner][enabled]", "true");
        form.add("components[payments][enabled]", "true");
        form.add("components[payments][features][refund_management]", "true");
        form.add("components[payments][features][dispute_management]", "true");
        form.add("components[payments][features][capture_payments]", "true");
        form.add("components[payouts][enabled]", "true");
        form.add("components[payouts][features][instant_payouts]", "true");
        form.add("components[payouts][features][standard_payouts]", "true");
        form.add("components[payouts][features][edit_payout_schedule]", "true");
        var session = stripe.post("/v1/account_sessions", form, null, null);
        return new AccountSession((String) session.get("client_secret"), stripe.publishableKey(), account.stripeAccountId());
    }

    // ── Payment areas ───────────────────────────────────────────────────────

    SalonPaymentSettings settings(UUID salonId) {
        var stored = jdbc.sql("SELECT area, enabled, checkout_ui FROM salon_payment_area WHERE salon_id = :salon")
                .param("salon", salonId)
                .query((rs, row) -> new SalonPaymentSettings.AreaSetting(rs.getString("area"), rs.getBoolean("enabled"),
                        CheckoutUi.valueOf(rs.getString("checkout_ui"))))
                .list();
        var areas = SalonPaymentSettings.AREAS.stream()
                .map(area -> stored.stream().filter(s -> s.area().equals(area)).findFirst()
                        .orElse(new SalonPaymentSettings.AreaSetting(area, false, CheckoutUi.REDIRECT)))
                .toList();
        return jdbc.sql("SELECT booking_payment_type, booking_deposit_percent, updated_at FROM salon_payment_settings WHERE salon_id = :salon")
                .param("salon", salonId)
                .query((rs, row) -> new SalonPaymentSettings(salonId, areas,
                        SalonPaymentSettings.BookingPaymentType.valueOf(rs.getString("booking_payment_type")),
                        rs.getInt("booking_deposit_percent"),
                        Optional.ofNullable(rs.getObject("updated_at", OffsetDateTime.class)).map(OffsetDateTime::toInstant).orElse(null)))
                .optional()
                .orElse(new SalonPaymentSettings(salonId, areas, SalonPaymentSettings.BookingPaymentType.FULL, 20, null));
    }

    @Transactional
    SalonPaymentSettings update(UUID salonId, List<SalonPaymentSettings.AreaSetting> requested,
                                SalonPaymentSettings.BookingPaymentType bookingType, int depositPercent) {
        var salon = requireSalon(salonId);
        var current = settings(salonId);
        var byArea = new LinkedHashMap<String, SalonPaymentSettings.AreaSetting>();
        current.areas().forEach(a -> byArea.put(a.area(), a));
        for (var area : requested == null ? List.<SalonPaymentSettings.AreaSetting>of() : requested) {
            if (area == null || !SalonPaymentSettings.AREAS.contains(area.area())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown payment area: " + (area == null ? null : area.area()));
            }
            byArea.put(area.area(), area);
        }
        for (var area : byArea.values()) {
            if (area.enabled() && !hasFeature(salon, featureOf(area.area()))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Enable the related salon feature first");
            }
            if (area.checkoutUi() != CheckoutUi.REDIRECT && stripe.publishableKey() == null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "In-page checkout needs the platform's Stripe publishable key — choose the redirect checkout for now");
            }
        }
        // Areas can be chosen as soon as the connected account exists; they only take effect once Stripe
        // activates card payments (see enabled()), since Stripe refuses charges on an account before that.
        if (byArea.values().stream().anyMatch(SalonPaymentSettings.AreaSetting::enabled) && accounts.findById(salonId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Connect a Stripe account before enabling payments");
        }
        if (bookingType == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking payment type is required");
        if (depositPercent < 1 || depositPercent > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Deposit percentage must be between 1 and 100");
        }
        var now = timestamp(Instant.now());
        jdbc.sql("INSERT INTO salon_payment_settings (salon_id, booking_payment_type, booking_deposit_percent, updated_at)"
                        + " VALUES (:id, :type, :deposit, :updated) ON CONFLICT (salon_id) DO UPDATE SET"
                        + " booking_payment_type = EXCLUDED.booking_payment_type, booking_deposit_percent = EXCLUDED.booking_deposit_percent,"
                        + " updated_at = EXCLUDED.updated_at")
                .param("id", salonId).param("type", bookingType.name()).param("deposit", depositPercent)
                .param("updated", now).update();
        for (var area : byArea.values()) {
            jdbc.sql("INSERT INTO salon_payment_area (salon_id, area, enabled, checkout_ui, updated_at)"
                            + " VALUES (:id, :area, :enabled, :ui, :updated) ON CONFLICT (salon_id, area) DO UPDATE SET"
                            + " enabled = EXCLUDED.enabled, checkout_ui = EXCLUDED.checkout_ui, updated_at = EXCLUDED.updated_at")
                    .param("id", salonId).param("area", area.area()).param("enabled", area.enabled())
                    .param("ui", area.checkoutUi().name()).param("updated", now).update();
        }
        return settings(salonId);
    }

    private static SalonFeature featureOf(String area) {
        return switch (area) {
            case "SHOP" -> SalonFeature.WEBSHOP;
            case "BOOKING" -> SalonFeature.BOOKING;
            case "POS" -> SalonFeature.DASHBOARD;
            case "MEMBERSHIP" -> SalonFeature.MEMBERSHIP;
            default -> throw new IllegalArgumentException(area);
        };
    }

    boolean isReady(UUID salonId) {
        var account = accounts.findById(salonId).orElse(null);
        if (account == null || !configured()) return false;
        account = refresh(account);
        return account.detailsSubmitted() && account.chargesEnabled();
    }

    @Override public boolean enabled(UUID salonId, String area) {
        if (!SalonPaymentSettings.AREAS.contains(area)) return false;
        return settings(salonId).area(area).enabled() && canCharge(salonId);
    }

    /**
     * Whether the salon's account can take charges, from the stored flags — so an area selected before
     * onboarding finished stays off for customers instead of sending them to a checkout Stripe would refuse.
     * While pending, Stripe is re-checked (throttled) so the area goes live without the owner revisiting.
     */
    private boolean canCharge(UUID salonId) {
        var account = accounts.findById(salonId).orElse(null);
        if (account == null) return false;
        if (account.detailsSubmitted() && account.chargesEnabled()) return true;
        if (!configured() || (account.updatedAt() != null
                && account.updatedAt().isAfter(Instant.now().minus(PENDING_ACCOUNT_RECHECK)))) return false;
        try {
            account = refresh(account);
            return account.detailsSubmitted() && account.chargesEnabled();
        } catch (ResponseStatusException e) {
            return false;
        }
    }

    @Override public PaymentGateway.BookingConfig bookingConfig(UUID salonId) {
        var config = settings(salonId);
        return new PaymentGateway.BookingConfig(config.area("BOOKING").enabled() && canCharge(salonId),
                config.bookingPaymentType(), config.bookingDepositPercent());
    }

    @Override public void requireEnabled(UUID salonId, String area) {
        if (!enabled(salonId, area) || !isReady(salonId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Stripe payments are not enabled for this salon");
        }
    }

    // ── Checkout ────────────────────────────────────────────────────────────

    @Override public Checkout createCheckout(UUID salonId, CheckoutRequest request) {
        var area = request.area();
        requireEnabled(salonId, area);
        if (request.amount() == null || request.amount().signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A positive price is required to accept online payment");
        }
        var account = accounts.findById(salonId).orElseThrow();
        var salon = requireSalon(salonId);
        var ui = checkoutUi(salonId, area, request.inlineCheckout());
        var reference = request.reference();
        var returnPage = returnPage(salon, area, request.returnUrl());
        var successUrl = paymentReturn(returnPage, "success", reference);
        var cancelUrl = paymentReturn(returnPage, "cancel", reference);
        var branding = branding(salon);

        var form = new LinkedMultiValueMap<String, String>();
        form.add("mode", "payment");
        form.add("ui_mode", ui.stripeUiMode());
        if (ui == CheckoutUi.REDIRECT) {
            form.add("success_url", successUrl);
            form.add("cancel_url", cancelUrl);
        } else {
            // Stripe sends the customer here after paying (and after a redirect-based method), like success_url.
            form.add("return_url", successUrl);
        }
        form.add("client_reference_id", area + ":" + reference);
        form.add("line_items[0][price_data][currency]", request.currency().toLowerCase(Locale.ROOT));
        form.add("line_items[0][price_data][unit_amount]", Long.toString(StripeAmounts.minorUnits(request.amount(), request.currency())));
        form.add("line_items[0][price_data][product_data][name]", request.itemName());
        form.add("line_items[0][quantity]", "1");
        form.add("metadata[salon_id]", salonId.toString());
        form.add("metadata[payment_area]", area);
        form.add("metadata[payment_reference]", reference);
        // Copied onto the PaymentIntent so refunds and Stripe's own lists trace back to the salon's record.
        form.add("payment_intent_data[metadata][salon_id]", salonId.toString());
        form.add("payment_intent_data[metadata][payment_area]", area);
        form.add("payment_intent_data[metadata][payment_reference]", reference);
        form.add("payment_intent_data[metadata][payment_channel]", PaymentLedger.Channel.CHECKOUT.name());
        if (request.customerEmail() != null && EMAIL.matcher(request.customerEmail().strip()).matches()) {
            form.add("customer_email", request.customerEmail().strip());
        }
        // The Elements form is styled by the website itself (Appearance API); Stripe's own pages take branding_settings.
        if (ui != CheckoutUi.ELEMENTS) {
            if (branding.displayName() != null) form.add("branding_settings[display_name]", branding.displayName());
            if (branding.backgroundColor() != null) form.add("branding_settings[background_color]", branding.backgroundColor());
            if (branding.primaryColor() != null) form.add("branding_settings[button_color]", branding.primaryColor());
        }
        var session = stripe.post("/v1/checkout/sessions", form, checkoutIdempotencyKey(area, reference, form),
                account.stripeAccountId());
        var sessionId = (String) session.get("id");
        ledger.recordCheckout(salonId, area, reference, ui, request.amount(), request.currency(), request.itemName(),
                request.customerEmail(), sessionId);
        if (ui == CheckoutUi.REDIRECT) {
            return new Checkout(ui, (String) session.get("url"), null, null, null, null, null, branding);
        }
        return new Checkout(ui, null, (String) session.get("client_secret"), stripe.publishableKey(), account.stripeAccountId(),
                successUrl.replace("{CHECKOUT_SESSION_ID}", sessionId), cancelUrl.replace("{CHECKOUT_SESSION_ID}", sessionId),
                branding);
    }

    /** The salon's choice for the area, when the client can show an in-page form and the server can serve one. */
    private CheckoutUi checkoutUi(UUID salonId, String area, boolean inlineCheckout) {
        if (!inlineCheckout || stripe.publishableKey() == null) return CheckoutUi.REDIRECT;
        return settings(salonId).area(area).checkoutUi();
    }

    /** Idempotent replays only for an identical request: a changed return page or e-mail gets a new session. */
    static String checkoutIdempotencyKey(String area, String reference, LinkedMultiValueMap<String, String> form) {
        try {
            var digest = MessageDigest.getInstance("SHA-256").digest(form.toString().getBytes(StandardCharsets.UTF_8));
            return "checkout-" + area.toLowerCase(Locale.ROOT) + "-" + reference + "-" + HexFormat.of().formatHex(digest, 0, 8);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** The salon's brand from its website theme; colours Stripe wouldn't accept are left to Stripe's defaults. */
    Branding branding(Salon salon) {
        var api = themes.getIfAvailable();
        var theme = api == null ? null : api.theme(salon.id());
        var name = salon.name() == null || salon.name().isBlank() ? null : salon.name().strip();
        if (theme == null) return new Branding(name, null, null, null);
        return new Branding(name, hex(theme.accentColor()), hex(theme.heroBg()),
                theme.fontFamily() == null || theme.fontFamily().isBlank() ? null : theme.fontFamily().strip());
    }

    private static String hex(String color) {
        return color != null && HEX_COLOR.matcher(color.strip()).matches() ? color.strip().toUpperCase(Locale.ROOT) : null;
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
            case "MEMBERSHIP" -> websiteAppUrl.isBlank()
                    ? "https://" + salon.handler() + "." + salonDomain + "/membership"
                    : websiteAppUrl + "/membership?slug=" + salon.handler();
            default -> dashboardAppUrl + "/" + salon.id() + "?view=cashier&cashierView=pos";
        };
    }

    private String allowedReturnPage(Salon salon, String returnUrl) {
        if (returnUrl == null || returnUrl.isBlank()) return null;
        try {
            var uri = URI.create(returnUrl.trim());
            var origin = origin(uri);
            if (origin == null) return null;
            // The salon desk (dashboard app) sells memberships too, and its card checkout returns there.
            boolean allowed = origin.equals(origin(websiteAppUrl)) || origin.equals(origin(bookingAppUrl))
                    || origin.equals(origin(dashboardAppUrl))
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

    // ── Terminal & refunds (behind the gateway) ─────────────────────────────

    @Override public TerminalPayment collectOnTerminal(UUID salonId, String area, String reference, BigDecimal amount,
                                                       String currency, String description, Long terminalId) {
        requireEnabled(salonId, area);
        if (amount == null || amount.signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A positive amount is required to take a card payment");
        }
        return terminals.collect(salonId, area, reference, amount, currency, description, terminalId);
    }

    @Override public Optional<Refund> refundIfPaid(UUID salonId, String area, String reference, BigDecimal amount,
                                                   String reason, String requestedBy) {
        return refunds.refundIfPaid(salonId, area, reference, amount, reason, requestedBy);
    }

    // ── Webhook ─────────────────────────────────────────────────────────────

    /**
     * Verifies the signature and routes the event. Runs in a transaction so Spring Modulith stores any
     * {@link StripePaymentEvent} before Stripe gets its 200: the feature module (membership, shop, booking,
     * till) then receives it asynchronously, and a failed delivery is retried from {@code event_publication}
     * rather than relying on Stripe to resend.
     */
    @Transactional
    void handleWebhook(String payload, String signature) {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Stripe webhooks are not configured");
        }
        verifySignature(payload, signature);
        String type;
        String connectedAccountId;
        Map<String, Object> object;
        try {
            @SuppressWarnings("unchecked") var event = (Map<String, Object>) new tools.jackson.databind.ObjectMapper().readValue(payload, Map.class);
            type = String.valueOf(event.get("type"));
            connectedAccountId = (String) event.get("account");
            @SuppressWarnings("unchecked") var data = (Map<String, Object>) event.get("data");
            @SuppressWarnings("unchecked") var dataObject = data == null ? null : (Map<String, Object>) data.get("object");
            object = dataObject;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Stripe webhook payload", e);
        }
        if (connectedAccountId == null || object == null) return;
        var account = accounts.findByStripeAccountId(connectedAccountId).orElse(null);
        if (account == null) return;
        // Anything failing from here (e.g. storing the event) is a 5xx, so Stripe resends the webhook.
        if (type.startsWith("checkout.session.")) {
            handleCheckoutSession(account.salonId(), type, object);
        } else if (INTENT_EVENTS.contains(type)) {
            if (account.salonId().toString().equals(nested(object, "metadata").get("salon_id"))
                    && PaymentLedger.Channel.TERMINAL.name().equals(nested(object, "metadata").get("payment_channel"))) {
                terminals.onPaymentIntent(account.salonId(), type, object);
            }
        } else if ("terminal.reader.action_failed".equals(type)) {
            terminals.onReaderActionFailed(object);
        } else if (REFUND_EVENTS.contains(type)) {
            refunds.onRefund(account.salonId(), object);
        }
    }

    private void handleCheckoutSession(UUID salonId, String type, Map<String, Object> object) {
        var metadata = nested(object, "metadata");
        if (!salonId.toString().equals(metadata.get("salon_id"))) return;
        var area = String.valueOf(metadata.get("payment_area"));
        if (!SalonPaymentSettings.AREAS.contains(area)) return;
        var reference = String.valueOf(metadata.get("payment_reference"));
        var sessionId = String.valueOf(object.get("id"));
        var succeeded = ("checkout.session.completed".equals(type) && "paid".equals(object.get("payment_status")))
                || "checkout.session.async_payment_succeeded".equals(type);
        var failed = "checkout.session.expired".equals(type) || "checkout.session.async_payment_failed".equals(type);
        if (!succeeded && !failed) return;
        var intentId = object.get("payment_intent") instanceof String id ? id : null;
        ledger.findBySession(sessionId).ifPresent(payment ->
                ledger.settle(payment.id(), succeeded ? "SUCCEEDED" : "FAILED", intentId,
                        succeeded ? null : "Checkout expired or the payment failed"));
        // Published on every delivery (feature modules only move PENDING records), as before the ledger existed.
        events.publishEvent(new StripePaymentEvent(salonId, area, reference, sessionId, succeeded));
    }

    private void verifySignature(String payload, String signature) {
        try {
            String timestamp = null;
            var candidates = new ArrayList<String>();
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
            var expected = HexFormat.of().formatHex(mac.doFinal((timestamp + "." + payload).getBytes(StandardCharsets.UTF_8)));
            boolean valid = candidates.stream().anyMatch(candidate -> MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII), candidate.getBytes(StandardCharsets.US_ASCII)));
            if (!valid) throw new IllegalArgumentException("Signature mismatch");
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Stripe webhook signature", e);
        }
    }

    // ── Accounts v2 ─────────────────────────────────────────────────────────

    private StripeConnectedAccount createAccount(Salon salon) {
        var countryCode = salon.location() == null ? null : countries.findByName(salon.location().country())
                .map(c -> c.code().toUpperCase()).orElse(null);
        if (countryCode == null || countryCode.length() != 2) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Add a valid salon country before connecting Stripe");
        }
        var existing = findAccountBySalon(salon.id());
        if (existing != null) return saveAccount(accountState(salon.id(), countryCode, existing));
        var body = accountRequest(salon, countryCode);
        var response = stripe.postV2("/v2/core/accounts", body, accountIdempotencyKey(salon.id(), body));
        return saveAccount(accountState(salon.id(), countryCode, response));
    }

    /**
     * A previous attempt may have created the Stripe account but failed before storing it locally; adopt that
     * account (matched by {@code metadata.salon_id}) instead of creating a duplicate. Closed accounts aren't listed.
     */
    private Map<String, Object> findAccountBySalon(UUID salonId) {
        // Accounts v2 permits at most 20 results per page (unlike several v1 list endpoints,
        // which accept up to 100). Follow next_page_url verbatim to continue cursor pagination.
        String page = "/v2/core/accounts?limit=20";
        for (int i = 0; page != null && i < MAX_ACCOUNT_PAGES; i++) {
            var response = stripe.getV2(page);
            if (response.get("data") instanceof List<?> data) {
                for (var item : data) {
                    if (item instanceof Map<?, ?> account && account.get("metadata") instanceof Map<?, ?> metadata
                            && salonId.toString().equals(metadata.get("salon_id"))) {
                        return stripe.getV2("/v2/core/accounts/" + account.get("id")
                                + "?include[0]=configuration.merchant&include[1]=requirements");
                    }
                }
            }
            page = response.get("next_page_url") instanceof String next && !next.isBlank() ? next : null;
        }
        return null;
    }

    private static final int MAX_ACCOUNT_PAGES = 20;

    /**
     * Idempotency keys only replay identical requests: a fixed per-salon key fails with "keys can only be reused
     * with the same parameters" as soon as the salon's name/email (or the request shape) changes between attempts.
     * Binding the key to the body keeps safe retries while letting a changed request through.
     */
    static String accountIdempotencyKey(UUID salonId, Map<String, Object> body) {
        try {
            var digest = MessageDigest.getInstance("SHA-256").digest(
                    new tools.jackson.databind.ObjectMapper().writeValueAsBytes(body));
            return "salon-connect-v2-" + salonId + "-" + HexFormat.of().formatHex(digest, 0, 8);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Deep copy with keys sorted so the JSON sent to Stripe (and the idempotency hash) is stable across JVMs. */
    private static Object sorted(Object value) {
        if (value instanceof Map<?, ?> map) {
            var copy = new java.util.TreeMap<String, Object>();
            map.forEach((k, v) -> copy.put(String.valueOf(k), sorted(v)));
            return copy;
        }
        if (value instanceof List<?> list) return list.stream().map(StripeConnectService::sorted).toList();
        return value;
    }

    /**
     * Accounts v2 connected account for direct charges on the salon's own account: the salon gets the
     * full Stripe Dashboard, Stripe collects its processing fees from the salon and carries negative-balance
     * liability ({@code dashboard: express} would force the platform to pay fees and cover losses).
     * Responsibilities can't be changed once the merchant configuration exists.
     */
    @SuppressWarnings("unchecked")
    static Map<String, Object> accountRequest(Salon salon, String countryCode) {
        var body = new LinkedHashMap<String, Object>();
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
        return (Map<String, Object>) sorted(body);
    }

    /** Maps a v2 account (with configuration.merchant + requirements included) onto the stored v1-style flags. */
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
    static Map<String, Object> nested(Map<String, Object> map, String... keys) {
        Map<String, Object> current = map == null ? Map.of() : map;
        for (var key : keys) {
            current = current.get(key) instanceof Map<?, ?> next ? (Map<String, Object>) next : Map.of();
        }
        return current;
    }

    private StripeConnectedAccount refresh(StripeConnectedAccount saved) {
        return saveAccount(accountState(saved.salonId(), saved.country(), fetchAccount(saved.stripeAccountId())));
    }

    private Map<String, Object> fetchAccount(String stripeAccountId) {
        return stripe.getV2("/v2/core/accounts/" + stripeAccountId
                + "?include[0]=configuration.merchant&include[1]=requirements");
    }

    /** pgjdbc can't infer a SQL type for java.time.Instant through JdbcClient; OffsetDateTime maps to timestamptz. */
    private static OffsetDateTime timestamp(Instant instant) {
        return instant == null ? null : OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    StripeConnectedAccount saveAccount(StripeConnectedAccount account) {
        jdbc.sql("INSERT INTO stripe_connected_account (salon_id, stripe_account_id, country, details_submitted, charges_enabled, payouts_enabled, updated_at) VALUES (:salon, :account, :country, :details, :charges, :payouts, :updated) ON CONFLICT (salon_id) DO UPDATE SET stripe_account_id = EXCLUDED.stripe_account_id, country = EXCLUDED.country, details_submitted = EXCLUDED.details_submitted, charges_enabled = EXCLUDED.charges_enabled, payouts_enabled = EXCLUDED.payouts_enabled, updated_at = EXCLUDED.updated_at")
                .param("salon", account.salonId()).param("account", account.stripeAccountId()).param("country", account.country())
                .param("details", account.detailsSubmitted()).param("charges", account.chargesEnabled())
                .param("payouts", account.payoutsEnabled()).param("updated", timestamp(account.updatedAt())).update();
        return account;
    }

    Salon requireSalon(UUID id) {
        return salons.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Salon not found"));
    }

    private boolean configured() { return stripe.secretConfigured() && webhookSecret != null && !webhookSecret.isBlank(); }
    private void requireStripe() {
        if (!configured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Stripe payments are not configured");
    }
    private boolean hasFeature(Salon salon, SalonFeature feature) {
        return salon.features().stream().anyMatch(f -> f.feature() == feature);
    }
}
