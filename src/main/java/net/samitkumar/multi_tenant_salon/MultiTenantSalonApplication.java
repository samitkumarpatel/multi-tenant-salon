package net.samitkumar.multi_tenant_salon;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.core.annotation.Order;
import org.springframework.modulith.Modulithic;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.ThrowingCustomizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@SpringBootApplication
@Modulithic(systemName = "MultiTenantSalon")
@EnableScheduling
@Slf4j
public class MultiTenantSalonApplication {

	public static void main(String[] args) {
		SpringApplication.run(MultiTenantSalonApplication.class, args);
	}

	@Bean
	JwtAuthenticationConverter jwtAuthenticationConverter() {
		JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
		converter.setJwtGrantedAuthoritiesConverter(jwt -> {
			// Keep default scope-based authorities (SCOPE_openid, SCOPE_profile, ...)
			JwtGrantedAuthoritiesConverter scopeConverter = new JwtGrantedAuthoritiesConverter();
			List<GrantedAuthority> authorities = new ArrayList<>(scopeConverter.convert(jwt));

			// Map custom "roles" claim → ROLE_SUPER_ADMIN, ROLE_OWNER, etc.
			List<String> roles = jwt.getClaimAsStringList("roles");
			if (roles != null) {
				roles.stream()
						.map(role -> new SimpleGrantedAuthority("ROLE_" + role))
						.forEach(authorities::add);
			}

			return authorities;
		});
		return converter;
	}

	@Bean
	ThrowingCustomizer<HttpSecurity> httpSecurityCustomizer(
			@Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuerUri,
			@Value("${app.security.permit-all:false}") boolean permitAll,
			SalonDeskAccess deskAccess, org.springframework.beans.factory.ObjectProvider<net.samitkumar.multi_tenant_salon.accesscontrol.UserAccessPolicy> policyProvider) {
		// Opening the whole API needs an explicit opt-in, not merely an unset issuer. The issuer
		// defaults to localhost, so keying off that alone meant a deploy that forgot OAUTH2_ISSUER_URI
		// silently served every owner endpoint unauthenticated with nothing but a warning in the log.
		// Set app.security.permit-all=true for local development (it is on in src/test/resources).
		// Both conditions, so neither alone can open the API: a real issuer always wins (the flag is
		// ignored), and an unset issuer alone is no longer enough.
		if (permitAll && issuerUri.contains("localhost")) {
			log.warn("app.security.permit-all=true — running with security disabled. Never set this outside local development.");
			return http -> http.csrf(AbstractHttpConfigurer::disable).cors(Customizer.withDefaults())
					.headers(headers -> headers.frameOptions(frame -> frame.disable())
							.addHeaderWriter((request, response) -> {
								if (!request.getRequestURI().startsWith("/mcp-app/")) response.setHeader("X-Frame-Options", "DENY");
							}))
					.authorizeHttpRequests(authH -> authH.requestMatchers("/**").permitAll());
		}
		var accessPolicy = policyProvider.getObject();
		return http ->
				http
						.csrf(AbstractHttpConfigurer::disable)
						.cors(Customizer.withDefaults())
						.headers(headers -> headers.frameOptions(frame -> frame.disable())
								.addHeaderWriter((request, response) -> {
									if (!request.getRequestURI().startsWith("/mcp-app/")) response.setHeader("X-Frame-Options", "DENY");
								}))
                        .oauth2ResourceServer(oauth2 -> oauth2
								.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
						).authorizeHttpRequests(authH -> authH
								//.anyRequest().access((_, ctx) -> new AuthorizationDecision(ctx.getRequest().getServerName().equals("localhost")))
								.requestMatchers(
										// Error dispatch must stay open — Spring Security filters the ERROR
										// dispatcher too, so without this any error response (404/400/500) for
										// an unauthenticated caller gets masked as a 401 by the entry point.
										"/error",
										"/actuator/**",
								"/api/salon", "/api/salon/**",
								"/api/public/rating/**",
										"/api/salon-onboarding", "/api/salon-onboarding/**",
										"/api/salon-utility/**",
										"/api/media/photos/**",
										// Anonymous ingestion from the public salon website — the controller itself
										// checks the target salon has opted into the ANALYTICS feature before
										// enqueuing anything.
										"/api/analytics/**",
								// The MCP server only publishes public salon information and read-only availability.
								"/mcp", "/mcp/**",
								// The MCP App view is a public static resource embedded by compatible hosts.
								"/mcp-app", "/mcp-app/**",
								"/internal/user-identity").permitAll()
								.requestMatchers("/api/payments/stripe/webhook").permitAll()
								.requestMatchers("/api/salon-super-admin/**").access((authentication, context) -> new AuthorizationDecision(
                                        authentication.get() instanceof JwtAuthenticationToken token
                                        && token.getAuthorities().stream().anyMatch(a -> "ROLE_SUPER_ADMIN".equals(a.getAuthority()))
                                        && accessPolicy.hasRole(token.getToken().getSubject(), null, "SUPER_ADMIN")))
								// A salon owner is also auto-enrolled as a staff_member row (role=MANAGER,
								// isOwner=true) so they can use the same portal for their own bookings/holidays —
								// but the user_identity view gives OWNER precedence over STAFF for the same
								// (email, salonId), so an owner's token never carries ROLE_STAFF. Gate on either
								// role here; StaffPortalController's isOwnStaffId check still scopes every
								// {staffId} route to the caller's own staff record(s) regardless of which role
								// got them past this gate.
								.requestMatchers("/api/salon-staff", "/api/salon-staff/**").hasAnyRole("STAFF", "OWNER")
								// Not scoped to a single salonId — just needs a valid caller identity.
								.requestMatchers("/api/salon-admin/my-salons", "/api/salon-admin/my-desk-salons").authenticated()
								// Only the {salonId}-templated patterns — NOT a bare "/api/salon-admin/**" catch-all.
								// RequestMatcherDelegatingAuthorizationManager evaluates matchers in declaration
								// order and uses the first match's path variables; a wildcard listed ahead of
								// these would always win first and carry no "salonId" variable, silently
								// denying every owner (context.getVariables().get("salonId") would be null).
								.requestMatchers("/api/salon-admin/{salonId}", "/api/salon-admin/{salonId}/**").access((authentication, context) -> {
									Authentication auth = authentication.get();

									if (!(auth instanceof JwtAuthenticationToken jwtAuth) || !auth.isAuthenticated()) {
										return new AuthorizationDecision(false);
									}

                                    String salonIdParam = context.getVariables().get("salonId");
                                    java.util.UUID target;
                                    try { target = java.util.UUID.fromString(salonIdParam); }
                                    catch (Exception e) { return new AuthorizationDecision(false); }
                                    var jwt = jwtAuth.getToken();
                                    boolean isSuperAdmin = auth.getAuthorities().stream()
                                            .anyMatch(a -> "ROLE_SUPER_ADMIN".equals(a.getAuthority()))
                                            && accessPolicy.hasRole(jwt.getSubject(), null, "SUPER_ADMIN");
                                    String requestPath = org.springframework.web.util.UriUtils.decode(
                                            context.getRequest().getRequestURI()
                                                    .substring(context.getRequest().getContextPath().length()),
                                            java.nio.charset.StandardCharsets.UTF_8);
                                    String tenantPath = requestPath.substring(("/api/salon-admin/" + salonIdParam).length());
                                    boolean tenantPeopleWrite = !java.util.Set.of("GET", "HEAD", "OPTIONS")
                                            .contains(context.getRequest().getMethod())
                                            && (tenantPath.equals("/staff") || tenantPath.startsWith("/staff/")
                                            || tenantPath.equals("/customers") || tenantPath.startsWith("/customers/"));
                                    // Platform oversight grants read access to people. Only this salon's
                                    // current owner may change customer records or staff identities/access.
                                    boolean allowed = accessPolicy.hasRole(jwt.getSubject(), target, "OWNER")
                                            || (isSuperAdmin && !tenantPeopleWrite);
                                    if (!allowed) allowed = deskAccess.allows(jwt, salonIdParam, context.getRequest());
									return new AuthorizationDecision(allowed);
								})

						);
	}

}
