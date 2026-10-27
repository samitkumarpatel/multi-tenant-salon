package net.samitkumar.multi_tenant_salon.developer;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.server.PathContainer;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

import java.util.List;
import java.util.UUID;

/**
 * What a salon's API client (an OAuth2 {@code client_credentials} token) may read. A token is one only if the
 * authorization server put {@code client_type=salon-api} in it; that server adds the claim for nothing else.
 *
 * <p>Access is a short allowlist of GET endpoints under {@code /api/salon-admin/{salonId}}, each tied to a scope the
 * owner chose when creating the client, and only for the salon named in the token's {@code salon_id} claim. A request
 * for any other salon, any other endpoint, or any write is refused. The owner checks (live {@code user_identity}
 * lookups) never apply to these tokens, so they can't reach owner-only, staff or super-admin behaviour by accident.
 *
 * <p>Stateless and static on purpose: the security rule must behave the same in every context, so it can't depend on a
 * bean that a module-scoped context might leave out.
 */
public final class ApiClientAccess {
    private ApiClientAccess() {}

    public static final String CLIENT_TYPE_CLAIM = "client_type";
    public static final String CLIENT_TYPE = "salon-api";
    public static final String SALON_CLAIM = "salon_id";
    private static final String BASE = "/api/salon-admin/{salonId}";

    /** A scope the owner can grant, as the admin page shows it. */
    public record ScopeInfo(String scope, String description, boolean personalData) {}

    private record Rule(PathPattern pattern, String scope) {}

    public static final List<ScopeInfo> SCOPES = List.of(
            new ScopeInfo("bookings:read", "Appointments: list and look up bookings", false),
            new ScopeInfo("services:read", "The service catalogue", false),
            new ScopeInfo("staff:read", "The team roster and each member's availability", false),
            new ScopeInfo("ratings:read", "Customer ratings and feedback", true),
            new ScopeInfo("orders:read", "Shop orders, products and stock", true),
            new ScopeInfo("customers:read", "The customer list with contact details", true),
            new ScopeInfo("loyalty:read", "Loyalty programme, rewards and members' point balances", true));

    // GET only, and deliberately narrow: no payments, analytics, settings, policies, domains, memberships, refunds,
    // loyalty redemption codes (a code is redeemable by whoever holds it) or anything that changes data.
    private static final List<Rule> READ = List.of(
            rule("/booking", "bookings:read"),
            rule("/booking/{bookingId}", "bookings:read"),
            rule("/services", "services:read"),
            rule("/services/{serviceId}", "services:read"),
            rule("/staff", "staff:read"),
            rule("/staff/{staffId}", "staff:read"),
            rule("/staff/{staffId}/availability", "staff:read"),
            rule("/staff/{staffId}/availability/overrides", "staff:read"),
            rule("/ratings", "ratings:read"),
            rule("/shop/orders", "orders:read"),
            rule("/shop/orders/{orderId}", "orders:read"),
            rule("/shop/products", "orders:read"),
            rule("/shop/products/{productId}", "orders:read"),
            rule("/shop/inventory", "orders:read"),
            rule("/customers", "customers:read"),
            rule("/customers/{customerId}", "customers:read"),
            rule("/loyalty", "loyalty:read"),
            rule("/loyalty/rewards", "loyalty:read"),
            rule("/loyalty/members", "loyalty:read"),
            rule("/loyalty/member", "loyalty:read"));

    private static Rule rule(String path, String scope) {
        return new Rule(PathPatternParser.defaultInstance.parse(BASE + path), scope);
    }

    /** Whether {@code jwt} is a salon API client's token. */
    public static boolean isApiClient(Jwt jwt) {
        return CLIENT_TYPE.equals(jwt.getClaimAsString(CLIENT_TYPE_CLAIM));
    }

    public static boolean isApiClient(Authentication authentication) {
        return authentication instanceof JwtAuthenticationToken token && isApiClient(token.getToken());
    }

    /** Whether this API client may make this request to {@code salonIdParam}'s owner API. */
    public static boolean allows(JwtAuthenticationToken authentication, String salonIdParam, HttpServletRequest request) {
        if (!isApiClient(authentication.getToken()) || !"GET".equals(request.getMethod())) return false;
        UUID requested;
        UUID bound;
        try {
            requested = UUID.fromString(salonIdParam);
            bound = UUID.fromString(authentication.getToken().getClaimAsString(SALON_CLAIM));
        } catch (RuntimeException e) {
            return false;
        }
        if (!requested.equals(bound)) return false;
        var path = PathContainer.parsePath(request.getRequestURI().substring(request.getContextPath().length()));
        return READ.stream().filter(rule -> rule.pattern().matches(path)).findFirst()
                .map(rule -> authentication.getAuthorities().stream().anyMatch(a -> ("SCOPE_" + rule.scope()).equals(a.getAuthority())))
                .orElse(false);
    }
}
