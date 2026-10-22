package net.samitkumar.multi_tenant_salon;

import jakarta.servlet.http.HttpServletRequest;
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

    private record Rule(HttpMethod method, PathPattern pattern) {}

    private static final String BASE = "/api/salon-admin/{salonId}";
    private static final List<Rule> DESK_ENDPOINTS = List.of(
            // salon, desk settings and the till
            rule(HttpMethod.GET, ""),
            rule(HttpMethod.GET, "/dashboard/settings"),
            rule(HttpMethod.GET, "/dashboard/cashier/items"),
            rule(HttpMethod.GET, "/dashboard/sales"),
            rule(HttpMethod.POST, "/dashboard/sales"),
            rule(HttpMethod.POST, "/dashboard/sales/card-checkout"),
            rule(HttpMethod.POST, "/dashboard/sales/terminal-checkout"),
            rule(HttpMethod.GET, "/payments/stripe"),
            // card readers: pick one, follow / retry / cancel the payment on it (registering stays owner-only)
            rule(HttpMethod.GET, "/payments/terminals"),
            rule(HttpMethod.GET, "/payments/terminal-payments/{paymentId}"),
            rule(HttpMethod.POST, "/payments/terminal-payments/{paymentId}/{action:cancel|retry|simulate}"),
            // appointments
            rule(HttpMethod.GET, "/booking"),
            rule(HttpMethod.GET, "/booking/slots"),
            rule(HttpMethod.GET, "/booking/{bookingId}"),
            rule(HttpMethod.POST, "/booking"),
            rule(HttpMethod.PUT, "/booking/{bookingId}"),
            rule(HttpMethod.POST, "/booking/{bookingId}/{action:confirm|cancel|complete|no-show}"),
            rule(HttpMethod.GET, "/availability"),
            rule(HttpMethod.GET, "/closures"),
            rule(HttpMethod.GET, "/holidays"),
            rule(HttpMethod.GET, "/services"),
            rule(HttpMethod.GET, "/staff"),
            rule(HttpMethod.GET, "/staff/{staffId}/availability"),
            rule(HttpMethod.GET, "/staff/{staffId}/availability/overrides"),
            // member check-in and selling memberships
            rule(HttpMethod.GET, "/membership/plans"),
            rule(HttpMethod.GET, "/membership/verify"),
            rule(HttpMethod.GET, "/membership/subscriptions/{subscriptionId}"),
            rule(HttpMethod.GET, "/membership/subscriptions/{subscriptionId}/qr.png"),
            rule(HttpMethod.POST, "/membership/subscriptions/{subscriptionId}/send-renewal-link"),
            rule(HttpMethod.POST, "/membership/desk-sales"));

    // Providers: module-scoped test contexts may leave either module out; then no staff access is granted.
    private final ObjectProvider<UserIdentityApi> identities;
    private final ObjectProvider<SalonApi> salons;

    SalonDeskAccess(ObjectProvider<UserIdentityApi> identities, ObjectProvider<SalonApi> salons) {
        this.identities = identities;
        this.salons = salons;
    }

    private static Rule rule(HttpMethod method, String path) {
        return new Rule(method, PathPatternParser.defaultInstance.parse(BASE + path));
    }

    /** Whether {@code jwt}'s holder may make this request to {@code salonIdParam}'s owner API as desk staff. */
    boolean allows(Jwt jwt, String salonIdParam, HttpServletRequest request) {
        if (!isDeskEndpoint(request)) return false;
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
        return tokenSaysStaff && isActiveDeskMember(jwt.getSubject(), salonId);
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
        HttpMethod method;
        try {
            method = HttpMethod.valueOf(request.getMethod());
        } catch (IllegalArgumentException e) {
            return false;
        }
        var path = PathContainer.parsePath(request.getRequestURI().substring(request.getContextPath().length()));
        return DESK_ENDPOINTS.stream().anyMatch(rule -> rule.method().equals(method) && rule.pattern().matches(path));
    }
}
