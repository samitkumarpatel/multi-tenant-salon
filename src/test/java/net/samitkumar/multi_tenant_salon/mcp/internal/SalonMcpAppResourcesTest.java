package net.samitkumar.multi_tenant_salon.mcp.internal;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** The CSP origins MCP hosts are told to allow images and videos from. */
class SalonMcpAppResourcesTest {

    @Test
    void cloudStorageAllowsTheCdnOriginPlusConfiguredExtras() {
        assertThat(SalonMcpAppResources.resourceDomains("AZURE", "https://staff.salonsaas.org/media", "http://localhost:8080",
                " https://images.example.com/x , not a url,https://cdn.example.com:8443/"))
                .containsExactly("https://staff.salonsaas.org", "https://images.example.com", "https://cdn.example.com:8443");
    }

    @Test
    void localStorageAllowsTheBackendOriginOnly() {
        assertThat(SalonMcpAppResources.resourceDomains("LOCAL", "https://staff.salonsaas.org", "https://api.salonsaas.org", ""))
                .containsExactly("https://api.salonsaas.org");
    }
}
