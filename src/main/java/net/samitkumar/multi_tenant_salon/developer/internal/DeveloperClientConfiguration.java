package net.samitkumar.multi_tenant_salon.developer.internal;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.support.RestClientHttpServiceGroupConfigurer;
import org.springframework.web.service.registry.ImportHttpServices;

import java.net.http.HttpClient;
import java.time.Duration;

@Configuration(proxyBeanMethods = false)
@ImportHttpServices(group = "authz-clients", types = AuthzClientsClient.class)
class DeveloperClientConfiguration {
    @Bean
    RestClientHttpServiceGroupConfigurer authzClientsConfigurer(
            @Value("${spring.application.authz.url:${spring.security.oauth2.resourceserver.jwt.issuer-uri:http://localhost:9000}}") String url,
            @Value("${spring.application.authz.client-management-key:}") String key) {
        return groups -> {
            var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(3)).followRedirects(HttpClient.Redirect.NEVER).build());
            factory.setReadTimeout(Duration.ofSeconds(10));
            groups.filterByName("authz-clients").forEachClient((name, builder) -> builder
                    .requestFactory(factory).baseUrl(url).defaultHeader("X-Internal-Api-Key", key));
        };
    }
}
