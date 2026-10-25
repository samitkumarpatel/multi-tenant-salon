package net.samitkumar.multi_tenant_salon;

import jakarta.servlet.http.HttpServletRequest;
import net.samitkumar.multi_tenant_salon.dashboard.DashboardApi;
import net.samitkumar.multi_tenant_salon.identity.UserIdentityApi;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpMethod;
import org.springframework.http.server.PathContainer;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Lets a salon's own staff (any active staff member, managers included) work the salon desk app,
 * which talks to the owner API under {@code /api/salon-admin/{salonId}/**}. Staff get only the
 * endpoints the desk uses — bookings, the till, member check-in and membership sales — and only for a
 * salon that runs the desk (DASHBOARD feature). Every request is re-checked against the database, so
 * removing or deactivating a staff member locks them out at once, not when their token expires.
 * Everything else under the owner API stays owner-only.
 */
@Component
public class SalonDeskAccess {

    /** Which of the owner's desk switches an endpoint answers to, on top of the staff-and-DASHBOARD checks. */
    private enum Gate { OPEN, BOOKING_MANAGEMENT, CASHIER }

    private record Rule(HttpMethod method, PathPattern pattern, Gate gate) {}

    private static final String BASE = "/api/salon-admin/{salonId}";
    private static final List<Rule> DESK_ENDPOINTS = List.of(
            // salon, desk settings and the till
            rule(HttpMethod.GET, ""),
            rule(HttpMethod.GET, "/dashboard/settings"),
            rule(HttpMethod.GET, "/dashboard/cashier/items"),
            // Settling an appointment at the counter is a till sale, so it answers to the cashier
            // switch (enforced in the manager) rather than to appointment management.
            rule(HttpMethod.GET, "/dashboard/cashier/bookings"),
            // Closing the till: whoever is at the counter has to be able to count the drawer.
            rule(HttpMethod.GET, "/dashboard/reports/daily"),
            rule(HttpMethod.GET, "/dashboard/sales"),
            rule(HttpMethod.POST, "/dashboard/sales"),
            rule(HttpMethod.POST, "/dashboard/sales/card-checkout"),
            rule(HttpMethod.POST, "/dashboard/sales/terminal-checkout"),
            // Correcting a sale rung up wrong is counter work — the operator who made the mistake has
            // to be able to fix it without fetching the owner.
            rule(HttpMethod.POST, "/dashboard/sales/{saleId}/void"),
            rule(HttpMethod.GET, "/payments/stripe"),
            // card readers: pick one, follow / retry / cancel the payment on it (registering stays owner-only)
            rule(HttpMethod.GET, "/payments/terminals"),
            rule(HttpMethod.GET, "/payments/terminal-payments/{paymentId}"),
            rule(HttpMethod.POST, "/payments/terminal-payments/{paymentId}/{action:cancel|retry|simulate}"),
            // appointments — only while the owner leaves "Appointment management" switched on for the desk
            bookingRule(HttpMethod.GET, "/booking"),
            bookingRule(HttpMethod.GET, "/booking/slots"),
            bookingRule(HttpMethod.GET, "/booking/{bookingId}"),
            bookingRule(HttpMethod.POST, "/booking"),
            bookingRule(HttpMethod.PUT, "/booking/{bookingId}"),
            bookingRule(HttpMethod.POST, "/booking/{bookingId}/{action:confirm|cancel|complete|no-show}"),
            // collecting from a customer who did not show up
            bookingRule(HttpMethod.POST, "/booking/{bookingId}/payment-link"),
            bookingRule(HttpMethod.GET, "/availability"),
            bookingRule(HttpMethod.GET, "/closures"),
            bookingRule(HttpMethod.GET, "/holidays"),
            // services and staff also feed the till catalogue, so they stay available either way
            rule(HttpMethod.GET, "/services"),
            rule(HttpMethod.GET, "/staff"),
            // the calendar's stylist colours — anyone at the desk may recolour, nothing else about the profile
            bookingRule(HttpMethod.PUT, "/staff/{staffId}/calendar-color"),
            bookingRule(HttpMethod.GET, "/staff/{staffId}/availability"),
            bookingRule(HttpMethod.GET, "/staff/{staffId}/availability/overrides"),
            // member check-in and selling memberships
            rule(HttpMethod.GET, "/membership/plans"),
            rule(HttpMethod.GET, "/membership/verify"),
            rule(HttpMethod.GET, "/membership/subscriptions/{subscriptionId}"),
            rule(HttpMethod.GET, "/membership/subscriptions/{subscriptionId}/qr.png"),
            rule(HttpMethod.POST, "/membership/subscriptions/{subscriptionId}/send-renewal-link"),
            // Taking money at the counter — cash included — answers to the same switch as the till.
            cashierRule(HttpMethod.POST, "/membership/desk-sales"));

    // Providers: module-scoped test contexts may leave either module out; then no staff access is granted.
    private final ObjectProvider<UserIdentityApi> identities;
    private final ObjectProvider<SalonApi> salons;
    private final ObjectProvider<DashboardApi> dashboards;

    SalonDeskAccess(ObjectProvider<UserIdentityApi> identities, ObjectProvider<SalonApi> salons,
                    ObjectProvider<DashboardApi> dashboards) {
        this.identities = identities;
        this.salons = salons;
        this.dashboards = dashboards;
    }

    private static Rule rule(HttpMethod method, String path) {
        return new Rule(method, PathPatternParser.defaultInstance.parse(BASE + path), Gate.OPEN);
    }

    /** An appointment endpoint: open to the desk only while the salon's "Appointment management" switch is on. */
    private static Rule bookingRule(HttpMethod method, String path) {
        return new Rule(method, PathPatternParser.defaultInstance.parse(BASE + path), Gate.BOOKING_MANAGEMENT);
    }

    /**
     * An endpoint that takes money at the counter: open to the desk only while the owner leaves the
     * cashier switched on. Enforced here rather than inside the module that owns the endpoint, so a
     * module such as membership never has to know the desk exists — a membership sold at the counter
     * is still a membership sale, and the owner is not subject to the desk's switches.
     */
    private static Rule cashierRule(HttpMethod method, String path) {
        return new Rule(method, PathPatternParser.defaultInstance.parse(BASE + path), Gate.CASHIER);
    }

    /** Whether {@code jwt}'s holder may make this request to {@code salonIdParam}'s owner API as desk staff. */
    boolean allows(Jwt jwt, String salonIdParam, HttpServletRequest request) {
        var matched = matchingRule(request);
        if (matched == null) return false;
        UUID salonId;
        try {
            salonId = UUID.fromString(salonIdParam);
        } catch (IllegalArgumentException | NullPointerException e) {
            return false;
        }
        List<Map<String, Object>> claimed = jwt.getClaim("salons");
        boolean tokenSaysStaff = claimed != null && claimed.stream().anyMatch(s ->
                salonIdParam.equals(String.valueOf(s.get("salonId")))
                        && "STAFF".equals(s.get("role")) && Boolean.TRUE.equals(s.get("active")));
        if (!tokenSaysStaff || !isActiveDeskMember(jwt.getSubject(), salonId)) return false;
        // The owner's "Appointment management" switch is an authorization input, not a UI preference:
        // with it off the desk must not be able to cancel or complete a booking by calling the API
        // directly, however the till screen happens to be rendered.
        return switch (matched.gate()) {
            case OPEN -> true;
            case BOOKING_MANAGEMENT -> deskCapabilities(salonId).canManageBookings();
            case CASHIER -> deskCapabilities(salonId).canTakeMoney();
        };
    }

    private DashboardApi.Capabilities deskCapabilities(UUID salonId) {
        var api = dashboards.getIfAvailable();
        return api == null ? DashboardApi.Capabilities.NONE : api.capabilities(salonId);
    }

    /** Live check: active owner or staff of this salon, and the salon runs the desk. */
    boolean isActiveDeskMember(String email, UUID salonId) {
        var identityApi = identities.getIfAvailable();
        var salonApi = salons.getIfAvailable();
        if (email == null || salonId == null || identityApi == null || salonApi == null) return false;
        boolean member = identityApi.findByEmail(email).stream()
                .flatMap(identity -> identity.salons().stream())
                .anyMatch(access -> salonId.equals(access.salonId()) && access.active()
                        && ("STAFF".equals(access.role()) || "OWNER".equals(access.role())));
        return member && salonApi.findById(salonId)
                .map(salon -> salon.features().stream().anyMatch(f -> f.feature() == SalonFeature.DASHBOARD))
                .orElse(false);
    }

    static boolean isDeskEndpoint(HttpServletRequest request) {
        return matchingRule(request) != null;
    }

    /** The allowlist entry this request matches, or {@code null} when the desk may never call it. */
    private static Rule matchingRule(HttpServletRequest request) {
        var method = HttpMethod.valueOf(request.getMethod());
        var path = PathContainer.parsePath(request.getRequestURI().substring(request.getContextPath().length()));
        return DESK_ENDPOINTS.stream()
                .filter(rule -> rule.method().equals(method) && rule.pattern().matches(path))
                .findFirst().orElse(null);
    }
}
