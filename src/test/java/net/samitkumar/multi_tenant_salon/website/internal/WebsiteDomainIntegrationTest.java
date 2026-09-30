package net.samitkumar.multi_tenant_salon.website.internal;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.client.RestTestClient;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.flyway.enabled=true", "spring.sql.init.mode=never",
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://auth.test",
        "spring.application.website-domains.enabled=true", "spring.application.website-domains.zone-id=test-zone",
        "spring.application.website-domains.api-token=test-token", "spring.application.website-domains.poll-interval-ms=3600000",
        "spring.application.cors.allowed-origin-patterns=https://*.salonsaas.org"
})
@Import(TestcontainersConfiguration.class)
class WebsiteDomainIntegrationTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired WebsiteDomainRepository repository;
    @Autowired WebsiteDomainService service;
    @MockitoBean CloudflareHostnameClient cloudflare;
    @MockitoBean DomainDnsClient dns;
    @MockitoBean JwtDecoder decoder;
    @Value("${local.server.port}") int port;
    RestTestClient client;
    UUID salonId;
    String path;

    @BeforeEach void setup() {
        jdbc.update("DELETE FROM website_domain");
        salonId = UUID.randomUUID();
        jdbc.update("INSERT INTO salon(id, name, handler, created_at) VALUES (?, 'Domain test', ?, now())", salonId, "domain-" + salonId);
        jdbc.update("INSERT INTO salon_feature(salon_id, salon_key, feature) VALUES (?, 0, 'STATIC_WEBSITE')", salonId);
        path = "/api/salon-admin/" + salonId + "/website/domains";
        client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
        when(decoder.decode(anyString())).thenAnswer(invocation -> {
            String token = invocation.getArgument(0);
            String role = token.equals("super") ? "SUPER_ADMIN" : token.equals("staff") ? "STAFF" : "OWNER";
            return Jwt.withTokenValue(token).header("alg", "RS256").subject(token)
                    .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300))
                    .claim("roles", List.of(role)).claim("salons", List.of(Map.of("salonId",
                            token.equals("other") ? UUID.randomUUID().toString() : salonId.toString(), "role", role, "active", true))).build();
        });
        when(dns.lookup(anyString(), anyString())).thenReturn(new DomainDnsClient.Reply(3, List.of()));
        when(cloudflare.list(anyString(), anyString())).thenReturn(new CloudflareHostnameClient.Envelope<>(true, List.of()));
        when(cloudflare.create(anyString(), anyMap())).thenReturn(remote("pending", "pending_validation"));
        when(cloudflare.get(anyString(), anyString())).thenReturn(remote("active", "active"));
        doReturn(new CloudflareHostnameClient.Envelope<>(true, Map.of("id", "remote-id"))).when(cloudflare).delete(anyString(), anyString());
    }

    @Test void completeLifecyclePreservesOwnershipAndOnlyServesReadyDomains() {
        client.post().uri(path).header("Authorization", "Bearer owner").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("hostname", "WWW.MySalon.dk.")).exchange().expectStatus().isOk()
                .expectBody().jsonPath("$.domain.hostname").isEqualTo("www.mysalon.dk")
                .jsonPath("$.domain.status").isEqualTo("PENDING_DNS");
        var d = repository.forSalon(salonId).orElseThrow();
        service.check(salonId);
        verifyNoInteractions(cloudflare);
        client.get().uri("/api/salon/domain/resolve?hostname=www.mysalon.dk").exchange().expectStatus().isNotFound();

        verifiedDns(d);
        advance(); service.check(salonId); // Persist ownership before any remote side effect.
        verifyNoInteractions(cloudflare);
        advance(); service.check(salonId); // Provider exists, certificate still pending.
        assertThat(service.settings(salonId).domain().status()).isEqualTo("PROVISIONING");
        client.get().uri("/api/salon/domain/resolve?hostname=www.mysalon.dk").exchange().expectStatus().isNotFound();
        advance(); service.check(salonId);
        client.get().uri("/api/salon/domain/resolve?hostname=www.mysalon.dk").exchange().expectStatus().isOk()
                .expectHeader().valueEquals("Cache-Control", "no-store")
                .expectBody().jsonPath("$.salonId").isEqualTo(salonId.toString());
        assertThat(service.isActiveOrigin("https://www.mysalon.dk")).isTrue();
        assertThat(service.isActiveOrigin("http://www.mysalon.dk")).isFalse();
        assertThat(service.isActiveOrigin("https://www.mysalon.dk.evil.com")).isFalse();
        assertThat(service.isActiveOrigin("https://www.mysalon.dk:8443")).isFalse();
        assertThat(service.isActiveOriginFor(salonId, "https://www.mysalon.dk")).isTrue();
        assertThat(service.isActiveOriginFor(UUID.randomUUID(), "https://www.mysalon.dk")).isFalse();

        when(cloudflare.delete(anyString(), anyString())).thenThrow(new IllegalStateException("provider unavailable"));
        client.delete().uri(path).header("Authorization", "Bearer owner").exchange().expectStatus().isAccepted();
        assertThat(service.isActiveOrigin("https://www.mysalon.dk")).isFalse();
        service.check(salonId);
        assertThat(service.settings(salonId).domain().status()).isEqualTo("DELETING");
        doReturn(new CloudflareHostnameClient.Envelope<>(true, Map.of("id", "remote-id"))).when(cloudflare).delete(anyString(), anyString());
        advance(); service.check(salonId);
        assertThat(repository.forSalon(salonId)).isEmpty();
        service.add(salonId, "www.mysalon.dk");
        assertThat(repository.forSalon(salonId).orElseThrow().token()).isNotEqualTo(d.token());
    }

    @Test void protectsManagementRoutesAndAllowsPublicCorsOnlyForActiveDomains() {
        client.get().uri(path).exchange().expectStatus().isUnauthorized();
        for (String token : List.of("other", "staff")) {
            client.post().uri(path).header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("hostname", "www.mysalon.dk")).exchange().expectStatus().isForbidden();
            client.delete().uri(path).header("Authorization", "Bearer " + token).exchange().expectStatus().isForbidden();
            client.post().uri(path + "/check").header("Authorization", "Bearer " + token).exchange().expectStatus().isForbidden();
        }
        client.get().uri(path).header("Authorization", "Bearer super").exchange().expectStatus().isOk();
        var d = activate();
        client.options().uri("/api/salon/" + salonId + "/chat").header("Origin", "https://www.mysalon.dk")
                .header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "content-type")
                .exchange().expectStatus().isOk().expectHeader().valueEquals("Access-Control-Allow-Origin", "https://www.mysalon.dk");
        client.options().uri(path).header("Origin", "https://www.mysalon.dk").header("Access-Control-Request-Method", "POST")
                .exchange().expectStatus().isForbidden();
        client.options().uri("/api/salon/" + salonId + "/chat").header("Origin", "https://unknown.dk")
                .header("Access-Control-Request-Method", "POST").exchange().expectStatus().isForbidden();
        jdbc.update("UPDATE salon SET status = 'DISABLED' WHERE id = ?", salonId);
        assertThat(service.isActiveOrigin("https://www.mysalon.dk")).isFalse();
        assertThatThrownBy(() -> service.resolve(d.hostname())).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
    }

    @Test void dnsRemovalRevokesServingAndTransientProviderFailuresHaveABoundedLease() {
        var d = activate();
        when(cloudflare.get(anyString(), anyString())).thenThrow(new IllegalStateException("outage"));
        advance(); service.check(salonId);
        assertThat(service.isActiveOrigin("https://www.mysalon.dk")).isTrue();
        jdbc.update("UPDATE website_domain SET active_until = now() - interval '1 second' WHERE id = ?", d.id());
        assertThat(service.isActiveOrigin("https://www.mysalon.dk")).isFalse();
        when(dns.lookup("_salonsaas-verification.www.mysalon.dk", "TXT")).thenReturn(new DomainDnsClient.Reply(3, List.of()));
        advance(); service.check(salonId);
        assertThat(service.settings(salonId).domain().status()).isEqualTo("PENDING_DNS");
    }

    @Test void rejectsDuplicatesAndInvalidHostnamesAndExpiresAbandonedClaims() {
        for (String host : List.of("https://www.mysalon.dk", "admin.salonsaas.org", "*.mysalon.dk", "127.0.0.1", "www.mysalon.dk/path")) {
            client.post().uri(path).header("Authorization", "Bearer owner").contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("hostname", host)).exchange().expectStatus().isBadRequest();
        }
        service.add(salonId, "www.mysalon.dk");
        client.post().uri(path).header("Authorization", "Bearer owner").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("hostname", "second.mysalon.dk")).exchange().expectStatus().isEqualTo(409);
        UUID other = UUID.randomUUID();
        jdbc.update("INSERT INTO salon(id, name, handler, created_at) VALUES (?, 'Other', ?, now())", other, "other-" + other);
        assertThatThrownBy(() -> repository.create(other, "www.mysalon.dk")).isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
        jdbc.update("UPDATE website_domain SET created_at = now() - interval '8 days'");
        service.check(salonId);
        assertThat(repository.forSalon(salonId)).isEmpty();
        verifyNoInteractions(cloudflare);
    }

    @Test void recoversProviderCreationAndThrottlesRepeatedChecks() {
        service.add(salonId, "www.mysalon.dk");
        var d = repository.forSalon(salonId).orElseThrow();
        verifiedDns(d);
        service.check(salonId);
        when(cloudflare.list(anyString(), anyString())).thenReturn(new CloudflareHostnameClient.Envelope<>(true, List.of(remote("active", "active").result())));
        advance(); service.check(salonId); service.check(salonId);
        verify(cloudflare, never()).create(anyString(), anyMap());
        verify(cloudflare, times(1)).list(anyString(), anyString());
        assertThat(service.settings(salonId).domain().status()).isEqualTo("ACTIVE");
        jdbc.update("DELETE FROM salon_feature WHERE salon_id = ?", salonId);
        assertThat(service.isActiveOrigin("https://www.mysalon.dk")).isFalse();
    }

    private WebsiteDomainRepository.Domain activate() {
        service.add(salonId, "www.mysalon.dk");
        var d = repository.forSalon(salonId).orElseThrow();
        verifiedDns(d);
        service.check(salonId);
        advance(); service.check(salonId);
        advance(); service.check(salonId);
        return repository.forSalon(salonId).orElseThrow();
    }
    private void verifiedDns(WebsiteDomainRepository.Domain d) {
        when(dns.lookup("_salonsaas-verification." + d.hostname(), "TXT")).thenReturn(new DomainDnsClient.Reply(0,
                List.of(new DomainDnsClient.Answer("_salonsaas-verification." + d.hostname() + ".", 16, "\"" + d.token() + "\""))));
        when(dns.lookup(d.hostname(), "CNAME")).thenReturn(new DomainDnsClient.Reply(0,
                List.of(new DomainDnsClient.Answer(d.hostname() + ".", 5, "customers.salonsaas.org."))));
    }
    private void advance() { jdbc.update("UPDATE website_domain SET checked_at = now() - interval '1 minute'"); }
    private CloudflareHostnameClient.Envelope<CloudflareHostnameClient.Hostname> remote(String status, String ssl) {
        return new CloudflareHostnameClient.Envelope<>(true, new CloudflareHostnameClient.Hostname("remote-id", "www.mysalon.dk", status, new CloudflareHostnameClient.Ssl(ssl)));
    }
}
