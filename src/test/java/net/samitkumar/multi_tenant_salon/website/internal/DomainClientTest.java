package net.samitkumar.multi_tenant_salon.website.internal;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class DomainClientTest {
    @Test void dnsClientReadsTheProvidersDnsJsonContentTypeAndQuotedTxtRecords() {
        var builder = RestClient.builder();
        DomainClientConfiguration.configureDns(builder);
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://cloudflare-dns.com/dns-query?name=_salonsaas-verification.www.mysalon.dk&type=TXT"))
                .andExpect(header("Accept", "application/dns-json"))
                .andRespond(withSuccess("""
                        {"Status":0,"TC":false,"RD":true,"Answer":[{"name":"_salonsaas-verification.www.mysalon.dk.","type":16,"TTL":300,"data":"\\\"claim-token\\\""}]}
                        """, MediaType.valueOf("application/dns-json")));
        var client = HttpServiceProxyFactory.builderFor(RestClientAdapter.create(builder.build())).build().createClient(DomainDnsClient.class);
        var reply = client.lookup("_salonsaas-verification.www.mysalon.dk", "TXT");
        assertThat(reply.status()).isZero();
        assertThat(reply.answers().getFirst().data()).isEqualTo("\"claim-token\"");
        server.verify();
    }

    @Test void dnsClientReadsTheSoaAuthoritySectionForZoneDiscovery() {
        var builder = RestClient.builder();
        DomainClientConfiguration.configureDns(builder);
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://cloudflare-dns.com/dns-query?name=www.fullstack1o1.net&type=SOA"))
                .andRespond(withSuccess("""
                        {"Status":3,"TC":false,"RD":true,"Question":[{"name":"www.fullstack1o1.net","type":6}],
                         "Authority":[{"name":"fullstack1o1.net","type":6,"TTL":300,"data":"ns1-05.azure-dns.com. azuredns-hostmaster.microsoft.com. 1 3600 300 2419200 300"}]}
                        """, MediaType.valueOf("application/dns-json")));
        var client = HttpServiceProxyFactory.builderFor(RestClientAdapter.create(builder.build())).build().createClient(DomainDnsClient.class);
        var reply = client.lookup("www.fullstack1o1.net", "SOA");
        assertThat(reply.answers()).isNull();
        assertThat(reply.authority()).extracting(DomainDnsClient.Answer::name).containsExactly("fullstack1o1.net");
        server.verify();
    }

    @Test void providerClientExpandsZoneAndReadsHostnameAndCertificateStatuses() {
        var builder = RestClient.builder();
        var server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("https://api.cloudflare.com/client/v4/zones/zone-id/custom_hostnames"))
                .andExpect(content().json("""
                        {"hostname":"www.mysalon.dk","ssl":{"type":"dv","method":"http"}}
                        """))
                .andRespond(withSuccess("""
                        {"success":true,"errors":[],"messages":[],"result":{"id":"remote","hostname":"www.mysalon.dk","status":"active","created_at":"2026-09-30","ssl":{"status":"pending_validation","method":"http"}}}
                        """, MediaType.APPLICATION_JSON));
        var client = HttpServiceProxyFactory.builderFor(RestClientAdapter.create(builder.build())).build().createClient(CloudflareHostnameClient.class);
        var reply = client.create("zone-id", Map.of("hostname", "www.mysalon.dk", "ssl", Map.of("type", "dv", "method", "http")));
        assertThat(reply.success()).isTrue();
        assertThat(reply.result().active()).isFalse();
        server.verify();
    }

    @Test void normalizesInternationalHostnamesAndRejectsNonHostInput() {
        assertThat(DomainHostname.customerHostname(" WWW.MÜLLER.dk. ", "salonsaas.org")).isEqualTo("www.xn--mller-kva.dk");
        for (String value : new String[]{"www.test.dk:443", "user@www.test.dk", "https://www.test.dk", "a..dk", "a_b.dk", "127.0.0.1", "admin.salonsaas.org", "salonsaas.org", "a.pages.dev"}) {
            assertThatThrownBy(() -> DomainHostname.customerHostname(value, "salonsaas.org")).isInstanceOf(IllegalArgumentException.class);
        }
    }
}
