package net.samitkumar.multi_tenant_salon.customer.internal;

import jakarta.servlet.http.HttpServletRequest;
import net.samitkumar.multi_tenant_salon.customer.internal.CustomerAccountViews.Account;
import net.samitkumar.multi_tenant_salon.customer.internal.CustomerAccountViews.SessionView;
import net.samitkumar.multi_tenant_salon.customer.internal.CustomerAccountViews.SignInAccepted;
import net.samitkumar.multi_tenant_salon.customer.internal.CustomerAccountViews.SignInRequest;
import net.samitkumar.multi_tenant_salon.customer.internal.CustomerAccountViews.VerifyRequest;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The customer's self-service account for one salon — {@code /api/salon/{salonId}/account/**}, under
 * the security config's {@code /api/salon/**} permit-all rule. The session token travels in
 * {@value #SESSION_HEADER}, not {@code Authorization}: the resource server would try to read a bearer
 * token as one of its own JWTs and reject it.
 */
@RestController
@RequestMapping("/api/salon/{salonId}/account")
class CustomerAccountController {

    static final String SESSION_HEADER = "X-Customer-Session";
    private static final int CODE_LENGTH = 6;

    private final CustomerAuthService auth;
    private final CustomerAccountService accounts;
    private final SalonApi salonApi;

    CustomerAccountController(CustomerAuthService auth, CustomerAccountService accounts, SalonApi salonApi) {
        this.auth = auth;
        this.accounts = accounts;
        this.salonApi = salonApi;
    }

    /** Always 202, whether or not the salon knows the address. */
    @PostMapping("/sign-in")
    @ResponseStatus(HttpStatus.ACCEPTED)
    SignInAccepted signIn(@PathVariable String salonId, @RequestBody SignInRequest body, HttpServletRequest request) {
        auth.requestCode(salonApi.resolveId(salonId), body == null ? null : body.email(), clientIp(request));
        return new SignInAccepted(CODE_LENGTH, auth.codeTtl().toSeconds());
    }

    @PostMapping("/verify")
    SessionView verify(@PathVariable String salonId, @RequestBody VerifyRequest body) {
        var session = auth.verify(salonApi.resolveId(salonId), body == null ? null : body.email(), body == null ? null : body.code());
        return new SessionView(session.token(), session.email(), session.expiresAt());
    }

    @GetMapping
    Account account(@PathVariable String salonId, @RequestHeader(name = SESSION_HEADER, required = false) String token) {
        var id = salonApi.resolveId(salonId);
        return accounts.account(id, auth.requireEmail(id, token));
    }

    /** A POST rather than DELETE: custom salon domains are only allowed GET/POST by CORS. */
    @PostMapping("/sign-out")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void signOut(@PathVariable String salonId, @RequestHeader(name = SESSION_HEADER, required = false) String token) {
        auth.signOut(salonApi.resolveId(salonId), token);
    }

    /**
     * Best effort, for rate limiting only. Behind the ingress the nearest proxy appends the real peer
     * to {@code X-Forwarded-For}; its last entry is the one a client can't forge.
     */
    private static String clientIp(HttpServletRequest request) {
        var forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwarded)) {
            var parts = forwarded.split(",");
            var last = parts[parts.length - 1].trim();
            if (!last.isEmpty()) return last.length() > 64 ? last.substring(0, 64) : last;
        }
        return request.getRemoteAddr();
    }
}
