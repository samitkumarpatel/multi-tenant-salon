package net.samitkumar.multi_tenant_salon.chat.internal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.support.RestClientHttpServiceGroupConfigurer;
import org.springframework.web.service.registry.ImportHttpServices;

@Configuration
@ImportHttpServices(group = "chat-internal-api", types = {SalonApiClient.class})
class ChatHttpClientConfiguration {

    @Bean
    RestClientHttpServiceGroupConfigurer chatInternalApiGroupConfigurer(
            @Value("${spring.application.chat.internal-api-base-url:http://localhost:8080}") String baseUrl) {
        return groups -> groups.filterByName("chat-internal-api")
                .forEachClient((name, builder) -> builder.baseUrl(baseUrl));
    }
}
