package net.samitkumar.multi_tenant_salon.mcp.internal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.support.RestClientHttpServiceGroupConfigurer;
import org.springframework.web.service.registry.ImportHttpServices;

@Configuration(proxyBeanMethods = false)
@ImportHttpServices(group = "mcp-booking-api", types = SalonMcpBookingClient.class)
class SalonMcpBookingClientConfiguration {
    @Bean
    RestClientHttpServiceGroupConfigurer mcpBookingApiConfigurer(
            @Value("${spring.application.chat.internal-api-base-url:http://localhost:8080}") String baseUrl) {
        return groups -> groups.filterByName("mcp-booking-api")
                .forEachClient((name, builder) -> builder.baseUrl(baseUrl));
    }
}
