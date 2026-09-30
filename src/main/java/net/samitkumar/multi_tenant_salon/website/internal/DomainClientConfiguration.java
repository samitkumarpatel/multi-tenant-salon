package net.samitkumar.multi_tenant_salon.website.internal;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientHttpServiceGroupConfigurer;
import org.springframework.web.service.registry.ImportHttpServices;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(DomainProperties.class)
@ImportHttpServices(group = "website-cloudflare", types = CloudflareHostnameClient.class)
@ImportHttpServices(group = "website-dns", types = DomainDnsClient.class)
class DomainClientConfiguration {
    @Bean
    RestClientHttpServiceGroupConfigurer domainClientConfigurer(DomainProperties properties) {
        return groups -> {
            var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build());
            factory.setReadTimeout(Duration.ofSeconds(10));
            groups.filterByName("website-cloudflare").forEachClient((name, builder) -> builder
                    .requestFactory(factory).defaultHeaders(h -> h.setBearerAuth(properties.apiToken() == null ? "" : properties.apiToken())));
            groups.filterByName("website-dns").forEachClient((name, builder) -> configureDns(builder.requestFactory(factory)));
        };
    }

    static void configureDns(RestClient.Builder builder) {
        var converter = new JacksonJsonHttpMessageConverter();
        converter.setSupportedMediaTypes(List.of(MediaType.APPLICATION_JSON, MediaType.valueOf("application/dns-json")));
        builder.configureMessageConverters(converters -> converters.withJsonConverter(converter));
    }
}
