package net.samitkumar.multi_tenant_salon.website.internal;

import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.website.WebsiteDomainApi;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.server.ResponseStatusException;
import lombok.extern.slf4j.Slf4j;
import java.net.URI;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Slf4j
class WebsiteDomainService implements WebsiteDomainApi {
    record DnsRecord(String type, String name, String value) {}
    record DomainView(String hostname, String status, String message, Instant checkedAt, List<DnsRecord> records) {}
    record Settings(boolean available, boolean websiteEnabled, DomainView domain) {}
    record Resolution(UUID salonId, String hostname) {}
    record PreferredDomain(String hostname) {}
    private final WebsiteDomainRepository repository;
    private final DomainProperties properties;
    private final CloudflareHostnameClient cloudflare;
    private final DomainDnsClient dns;
    private final SalonApi salons;
    private final TransactionTemplate transactions;

    WebsiteDomainService(WebsiteDomainRepository repository, DomainProperties properties, CloudflareHostnameClient cloudflare,
                         DomainDnsClient dns, SalonApi salons, TransactionTemplate transactions) {
        this.repository = repository; this.properties = properties; this.cloudflare = cloudflare;
        this.dns = dns; this.salons = salons; this.transactions = transactions;
    }

    Settings settings(UUID salonId) {
        return new Settings(properties.configured(), websiteEnabled(salonId), repository.forSalon(salonId).map(this::view).orElse(null));
    }

    PreferredDomain preferred(UUID salonId) {
        if (!properties.configured()) return new PreferredDomain(null);
        return new PreferredDomain(repository.forSalon(salonId)
                .filter(d -> repository.activeSalon(d.hostname()).isPresent()).map(WebsiteDomainRepository.Domain::hostname).orElse(null));
    }

    Settings add(UUID salonId, String hostname) {
        requireConfigured();
        if (!websiteEnabled(salonId)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Enable the website feature first.");
        final String normalized;
        try { normalized = DomainHostname.customerHostname(hostname, properties.platformDomain()); }
        catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage()); }
        try { repository.create(salonId, normalized); }
        catch (DuplicateKeyException e) { throw new ResponseStatusException(HttpStatus.CONFLICT, "This domain or salon already has a domain connection. Disconnect the existing connection first."); }
        return settings(salonId);
    }

    Settings check(UUID salonId) {
        requireConfigured();
        repository.forSalon(salonId).ifPresent(d -> reconcile(d.id()));
        return settings(salonId);
    }

    Settings disconnect(UUID salonId) {
        // Commit removal from serving before making any provider request; cleanup is retried by the job.
        repository.deleting(salonId);
        return settings(salonId);
    }

    Resolution resolve(String hostname) {
        if (!properties.configured()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        final String normalized;
        try { normalized = DomainHostname.normalize(hostname); }
        catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.NOT_FOUND); }
        return repository.activeSalon(normalized).map(id -> new Resolution(id, normalized))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    @Override public boolean isActiveOrigin(String origin) {
        return activeSalonForOrigin(origin).isPresent();
    }

    @Override public boolean isActiveOriginFor(UUID salonId, String origin) {
        return salonId != null && activeSalonForOrigin(origin).filter(salonId::equals).isPresent();
    }

    private java.util.Optional<UUID> activeSalonForOrigin(String origin) {
        if (origin == null || !properties.configured()) return java.util.Optional.empty();
        try {
            URI uri = URI.create(origin);
            if (!"https".equals(uri.getScheme()) || uri.getRawUserInfo() != null || uri.getHost() == null
                    || (uri.getPort() != -1 && uri.getPort() != 443) || uri.getRawQuery() != null
                    || uri.getRawFragment() != null || !uri.getRawPath().isEmpty()) return java.util.Optional.empty();
            return repository.activeSalon(DomainHostname.normalize(uri.getHost()));
        } catch (IllegalArgumentException e) { return java.util.Optional.empty(); }
    }

    @Scheduled(fixedDelayString = "${spring.application.website-domains.poll-interval-ms:60000}")
    void poll() {
        if (!properties.configured()) return;
        for (UUID id : repository.due()) {
            try { reconcile(id); }
            catch (RuntimeException e) { log.warn("Domain reconciliation could not complete for {} ({})", id, e.getClass().getSimpleName()); }
        }
    }

    void reconcile(UUID id) {
        transactions.executeWithoutResult(tx -> repository.lock(id).ifPresent(d -> {
            if (d.checkedAt() != null && d.checkedAt().isAfter(Instant.now().minusSeconds(30))) return;
            try {
                if ("DELETING".equals(d.status()) || (d.verifiedAt() == null && d.createdAt().isBefore(Instant.now().minus(7, ChronoUnit.DAYS)))) {
                    remove(d);
                    return;
                }
                if (!websiteEnabled(d.salonId())) {
                    repository.status(id, "PENDING_DNS", "The salon website is disabled. Enable it to reconnect.");
                    return;
                }
                if (!matches("_salonsaas-verification." + d.hostname(), "TXT", 16, d.token())) {
                    repository.status(id, "PENDING_DNS", "Add the ownership TXT record at your DNS provider and keep it in place.");
                    return;
                }
                if (d.verifiedAt() == null) {
                    // Commit intent before external creation so a process crash cannot orphan a hostname.
                    repository.verified(id);
                    repository.status(id, "PROVISIONING", "Ownership verified. We will connect the hostname and prepare HTTPS automatically.");
                    return;
                }
                if (!matches(d.hostname(), "CNAME", 5, properties.cnameTarget())) {
                    repository.status(id, "PENDING_DNS", "Point the CNAME to " + properties.cnameTarget() + ". Use DNS-only mode if your DNS provider offers proxying.");
                    return;
                }
                // The provider can recover an interrupted create by looking up the exact hostname.
                var remote = d.providerId() == null ? ensureHostname(d.hostname()) : getHostname(d.providerId(), d.hostname());
                if (!d.hostname().equals(remote.hostname()) || remote.id() == null || remote.id().isBlank()) {
                    throw new IllegalStateException("Unexpected provider hostname");
                }
                repository.provider(id, remote.id());
                if (remote.active()) {
                    repository.active(id);
                } else {
                    repository.status(id, "PROVISIONING", "DNS is verified. HTTPS is being prepared; we will check again automatically.");
                }
            } catch (RuntimeException e) {
                // Do not expose provider payloads, credentials or DNS internals. Active leases expire after 24h.
                repository.status(id, "DELETING".equals(d.status()) ? "DELETING" : "ACTIVE".equals(d.status()) ? "ACTIVE" : "ERROR",
                        "We could not complete the domain check. We will retry automatically; contact support if this continues.");
                log.warn("Domain check failed for {} ({})", id, e.getClass().getSimpleName());
            }
        }));
    }

    private CloudflareHostnameClient.Hostname ensureHostname(String hostname) {
        var existing = result(cloudflare.list(properties.zoneId(), hostname)).stream()
                .filter(h -> hostname.equals(h.hostname())).findFirst();
        return existing.orElseGet(() -> result(cloudflare.create(properties.zoneId(),
                Map.of("hostname", hostname, "ssl", Map.of("method", "http", "type", "dv", "settings", Map.of("min_tls_version", "1.2"))))));
    }

    private CloudflareHostnameClient.Hostname getHostname(String id, String hostname) {
        try { return result(cloudflare.get(properties.zoneId(), id)); }
        catch (HttpClientErrorException.NotFound e) { return ensureHostname(hostname); }
    }

    private void remove(WebsiteDomainRepository.Domain d) {
        String providerId = d.providerId();
        if (providerId == null && d.verifiedAt() != null) {
            providerId = result(cloudflare.list(properties.zoneId(), d.hostname())).stream()
                    .filter(h -> d.hostname().equals(h.hostname())).map(CloudflareHostnameClient.Hostname::id).findFirst().orElse(null);
        }
        if (providerId != null) {
            try { result(cloudflare.delete(properties.zoneId(), providerId)); }
            catch (HttpClientErrorException.NotFound ignored) { /* Already removed. */ }
        }
        repository.delete(d.id());
    }

    private boolean matches(String hostname, String type, int recordType, String expected) {
        var reply = dns.lookup(hostname, type);
        if (reply.status() != 0 && reply.status() != 3) throw new IllegalStateException("DNS temporarily unavailable");
        if (reply.status() == 3) return false;
        return reply.answers() != null && reply.answers().stream().anyMatch(a -> a.type() == recordType
                && hostname.equalsIgnoreCase(a.name().replaceFirst("\\.$", ""))
                && (recordType == 16 ? expected.equals(a.data().replace("\"", ""))
                : expected.equalsIgnoreCase(a.data().replaceFirst("\\.$", ""))));
    }

    private static <T> T result(CloudflareHostnameClient.Envelope<T> envelope) {
        if (envelope == null || !envelope.success() || envelope.result() == null) throw new IllegalStateException("Provider request failed");
        return envelope.result();
    }

    private boolean websiteEnabled(UUID salonId) {
        return salons.findById(salonId).filter(s -> s.status() == Salon.SalonStatus.ACTIVE)
                .map(s -> s.features().stream().anyMatch(f -> f.feature() == SalonFeature.STATIC_WEBSITE)).orElse(false);
    }

    private DomainView view(WebsiteDomainRepository.Domain d) {
        boolean stale = "ACTIVE".equals(d.status()) && (d.activeUntil() == null || d.activeUntil().isBefore(Instant.now()));
        return new DomainView(d.hostname(), stale ? "ERROR" : d.status(), stale ? "Domain verification has expired. Check the connection again." : d.message(),
                d.checkedAt(), List.of(new DnsRecord("TXT", "_salonsaas-verification." + d.hostname(), d.token()),
                new DnsRecord("CNAME", d.hostname(), properties.cnameTarget())));
    }
    private void requireConfigured() {
        if (!properties.configured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Custom domains are not configured yet. Please contact support.");
    }
}
