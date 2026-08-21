package net.samitkumar.multi_tenant_salon;

import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.modulith.Modulithic;
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
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@SpringBootApplication
@Modulithic(systemName = "MultiTenantSalon")
@Slf4j
public class MultiTenantSalonApplication {

	public static void main(String[] args) {
		SpringApplication.run(MultiTenantSalonApplication.class, args);
	}

	@Bean
	WebMvcConfigurer corsConfigurer(@Value("${spring.application.cors.allowed-origin-patterns:*}") String[] allowedOriginPatterns) {
		return new WebMvcConfigurer() {
			@Override
			public void addCorsMappings(@NonNull CorsRegistry registry) {
				registry.addMapping("/**")
						.allowedOriginPatterns(allowedOriginPatterns)
						.allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD")
						.allowedHeaders("Content-Type", "Authorization", "X-Requested-With")
						.exposedHeaders("Content-Type", "x-tenant-id")
						.allowCredentials(false)
						.maxAge(300);
			}
		};
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
	ThrowingCustomizer<HttpSecurity> httpSecurityCustomizer() {
		return http ->
				http
						.csrf(AbstractHttpConfigurer::disable)
						.cors(Customizer.withDefaults())
						.oauth2ResourceServer(oauth2 -> oauth2
								.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
						).authorizeHttpRequests(authH -> authH
								.requestMatchers(
										"/actuator/**",
										"/api/salon", "/api/salon/**",
										"/api/salon-onboarding", "/api/salon-onboarding/**",
										"/api/salon-utility/**",
										"/api/media/photos/**",
										"/internal/user-identity").permitAll()
								.requestMatchers("/api/salon-super-admin/**").hasRole("SUPER_ADMIN")
								.requestMatchers("/api/salon-staff", "/api/salon-staff/**").hasRole("STAFF")
								// Not scoped to a single salonId — just needs a valid caller identity.
								.requestMatchers("/api/salon-admin/my-salons").authenticated()
								.requestMatchers("/api/salon-admin","/api/salon-admin/**","/api/salon-admin/{salonId}", "/api/salon-admin/{salonId}/**").access((authentication, context) -> {
									Authentication auth = authentication.get();

									if (auth == null || !auth.isAuthenticated()) {
										return new AuthorizationDecision(false);
									}

									boolean isSuperAdmin = auth.getAuthorities().stream()
											.anyMatch(a -> a.getAuthority().equals("ROLE_SUPER_ADMIN"));
									log.info("isSuperAdmin: {}", isSuperAdmin);
									if (isSuperAdmin) return new AuthorizationDecision(true); // super admin bypasses tenant check

                                    assert context != null;
                                    String salonIdParam = context.getVariables().get("salonId");
									Jwt jwt = ((JwtAuthenticationToken) auth).getToken();
									List<Map<String, Object>> salons = jwt.getClaim("salons");
									log.info("Requested salonId: {} having jwt: {}", salonIdParam, salons);
									boolean allowed = salons != null && salons.stream().anyMatch(s ->
											String.valueOf(s.get("salonId")).equals(salonIdParam)
													&& "OWNER".equals(s.get("role"))
													&& Boolean.TRUE.equals(s.get("active"))
									);
									return new AuthorizationDecision(allowed);
								})

						);
	}

}
