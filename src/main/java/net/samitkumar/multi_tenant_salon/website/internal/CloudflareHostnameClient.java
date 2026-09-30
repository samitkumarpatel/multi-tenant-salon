package net.samitkumar.multi_tenant_salon.website.internal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.service.annotation.*;
import java.util.List;
import java.util.Map;

@HttpExchange("https://api.cloudflare.com/client/v4/zones/{zone}/custom_hostnames")
interface CloudflareHostnameClient {
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Envelope<T>(boolean success, T result) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Ssl(String status) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Hostname(String id, String hostname, String status, Ssl ssl) {
        boolean active() { return "active".equals(status) && ssl != null && "active".equals(ssl.status()); }
    }

    @GetExchange
    Envelope<List<Hostname>> list(@PathVariable String zone, @RequestParam String hostname);
    @PostExchange
    Envelope<Hostname> create(@PathVariable String zone, @RequestBody Map<String, Object> body);
    @GetExchange("/{id}")
    Envelope<Hostname> get(@PathVariable String zone, @PathVariable String id);
    @DeleteExchange("/{id}")
    Envelope<Map<String, Object>> delete(@PathVariable String zone, @PathVariable String id);
}
