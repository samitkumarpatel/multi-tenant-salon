package net.samitkumar.multi_tenant_salon.website.internal;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("spring.application.website-domains")
record DomainProperties(boolean enabled, String zoneId, String apiToken, String cnameTarget, String platformDomain) {
    boolean configured() {
        return enabled && zoneId != null && !zoneId.isBlank() && apiToken != null && !apiToken.isBlank()
                && cnameTarget != null && !cnameTarget.isBlank();
    }

    // Never include the API credential in logs or exception messages.
    @Override public String toString() { return "DomainProperties[enabled=" + enabled + "]"; }
}
