package net.samitkumar.multi_tenant_salon.website.internal;

import java.net.IDN;
import java.util.Locale;

final class DomainHostname {
    private DomainHostname() {}

    static String normalize(String value) {
        if (value == null) throw new IllegalArgumentException("Enter a hostname, for example www.mysalon.dk.");
        String host = value.strip();
        if (host.endsWith(".")) host = host.substring(0, host.length() - 1);
        host = IDN.toASCII(host, IDN.USE_STD3_ASCII_RULES).toLowerCase(Locale.ROOT);
        if (host.length() > 253 || !host.contains(".") || host.matches("[0-9.]+")) {
            throw new IllegalArgumentException("Enter a public hostname, for example www.mysalon.dk.");
        }
        for (String label : host.split("\\.", -1)) {
            if (!label.matches("[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")) {
                throw new IllegalArgumentException("Enter only a hostname, without https://, a port or a path.");
            }
        }
        if (host.matches(".*\\.(localhost|local|internal|test|invalid|example)")) {
            throw new IllegalArgumentException("Enter a public hostname.");
        }
        return host;
    }

    static String customerHostname(String value, String platformDomain) {
        String host = normalize(value);
        String platform = normalize(platformDomain);
        if (host.equals(platform) || host.endsWith("." + platform) || host.endsWith(".pages.dev")
                || host.endsWith(".workers.dev")) {
            throw new IllegalArgumentException("Use a domain you own outside the SalonSaaS hosting domains.");
        }
        return host;
    }
}
