package net.samitkumar.multi_tenant_salon;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import net.samitkumar.multi_tenant_salon.accesscontrol.UserAccessPolicy;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.util.UUID;

/** Additional live checks on staff-ID routes; JWT roles alone cannot authorize a removed member. */
@Component
class UserAccessInterceptor implements HandlerInterceptor, WebMvcConfigurer {
    private final org.springframework.beans.factory.ObjectProvider<UserAccessPolicy> policies;
    private final JdbcClient jdbc;
    UserAccessInterceptor(org.springframework.beans.factory.ObjectProvider<UserAccessPolicy> policies, JdbcClient jdbc) { this.policies = policies; this.jdbc = jdbc; }
    @Override public void addInterceptors(InterceptorRegistry registry) { registry.addInterceptor(this); }
    @Override public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof JwtAuthenticationToken token)) return true;
        var policy = policies.getObject();
        String path = org.springframework.web.util.UriUtils.decode(
                request.getRequestURI().substring(request.getContextPath().length()),
                java.nio.charset.StandardCharsets.UTF_8);
        String email = token.getToken().getSubject();
        if (path.startsWith("/api/salon-staff")) {
            String suffix = path.substring("/api/salon-staff".length());
            String first = suffix.startsWith("/") ? suffix.substring(1).split("/")[0] : "";
            if (first.matches("[0-9]+")) {
                UUID salon = jdbc.sql("SELECT salon_id FROM staff_member WHERE id = :id AND lower(btrim(email)) = :email AND status = 'ACTIVE'")
                        .param("id", Long.parseLong(first)).param("email", UserAccessPolicy.canonical(email))
                        .query(UUID.class).optional().orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN));
                if (!policy.hasRole(email, salon, "STAFF") && !policy.hasRole(email, salon, "OWNER"))
                    throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            }
        }
        return true;
    }
}
