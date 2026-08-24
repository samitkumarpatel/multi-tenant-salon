package net.samitkumar.multi_tenant_salon.notification.internal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.support.RestClientHttpServiceGroupConfigurer;
import org.springframework.web.service.registry.ImportHttpServices;

@Configuration
@ImportHttpServices(group = "notification-mailjet", types = {MailjetClient.class})
class MailjetConfiguration {

    @Bean
    RestClientHttpServiceGroupConfigurer notificationMailjetGroupConfigurer(
            @Value("${spring.application.notification.mailjet.api-key:}") String apiKey,
            @Value("${spring.application.notification.mailjet.api-secret:}") String apiSecret) {
        return groups -> groups.filterByName("notification-mailjet")
                .forEachClient((name, builder) ->
                        builder.defaultHeaders(h -> h.setBasicAuth(apiKey, apiSecret)));
    }
}
