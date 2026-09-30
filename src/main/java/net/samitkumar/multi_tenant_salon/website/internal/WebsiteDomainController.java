package net.samitkumar.multi_tenant_salon.website.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;

@RestController
class WebsiteDomainController {
    private final WebsiteDomainService service;
    private final SalonApi salons;
    WebsiteDomainController(WebsiteDomainService service, SalonApi salons) { this.service = service; this.salons = salons; }
    record AddDomain(@NotBlank @Size(max = 253) String hostname) {}

    @GetMapping("/api/salon-admin/{salonId}/website/domains")
    WebsiteDomainService.Settings settings(@PathVariable String salonId) { return service.settings(salons.resolveId(salonId)); }
    @PostMapping("/api/salon-admin/{salonId}/website/domains")
    WebsiteDomainService.Settings add(@PathVariable String salonId, @Valid @RequestBody AddDomain body) { return service.add(salons.resolveId(salonId), body.hostname()); }
    @PostMapping("/api/salon-admin/{salonId}/website/domains/check")
    WebsiteDomainService.Settings check(@PathVariable String salonId) { return service.check(salons.resolveId(salonId)); }
    @DeleteMapping("/api/salon-admin/{salonId}/website/domains")
    ResponseEntity<WebsiteDomainService.Settings> disconnect(@PathVariable String salonId) {
        return ResponseEntity.accepted().body(service.disconnect(salons.resolveId(salonId)));
    }
    @GetMapping("/api/salon/domain/resolve")
    ResponseEntity<WebsiteDomainService.Resolution> resolve(@RequestParam String hostname) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.resolve(hostname));
    }
    @GetMapping("/api/salon/{salonId}/website/domain")
    ResponseEntity<WebsiteDomainService.PreferredDomain> preferred(@PathVariable String salonId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.preferred(salons.resolveId(salonId)));
    }
}
