package net.samitkumar.multi_tenant_salon;

import net.samitkumar.multi_tenant_salon.website.WebsiteDomainApi;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import java.util.List;

@Configuration(proxyBeanMethods = false)
class WebsiteCorsConfiguration {
    @Bean
    CorsConfigurationSource corsConfigurationSource(ObjectProvider<WebsiteDomainApi> domains,
            @Value("${spring.application.cors.allowed-origin-patterns:*}") List<String> patterns) {
        return request -> {
            var cors = new CorsConfiguration();
            cors.setAllowedOriginPatterns(patterns);
            cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"));
            cors.setAllowedHeaders(List.of("Content-Type", "Authorization", "X-Requested-With"));
            cors.setExposedHeaders(List.of("Content-Type", "x-tenant-id"));
            cors.setAllowCredentials(false);
            cors.setMaxAge(300L);
            String origin = request.getHeader("Origin");
            String path = request.getRequestURI();
            boolean publicPath = path.startsWith("/api/salon/") || path.startsWith("/api/salon-utility/")
                    || path.equals("/api/analytics/events");
            // Isolated Modulith contexts may omit the website module; that grants no additional origins.
            var domainApi = origin != null && cors.checkOrigin(origin) == null && publicPath ? domains.getIfAvailable() : null;
            if (domainApi != null && domainApi.isActiveOrigin(origin)) {
                cors.setAllowedOrigins(List.of(origin));
                cors.setAllowedMethods(List.of("GET", "POST", "OPTIONS", "HEAD"));
                cors.setAllowedHeaders(List.of("Content-Type", "X-Requested-With"));
                cors.setMaxAge(0L);
            }
            return cors;
        };
    }
}
