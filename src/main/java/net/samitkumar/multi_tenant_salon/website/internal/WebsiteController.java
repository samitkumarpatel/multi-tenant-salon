package net.samitkumar.multi_tenant_salon.website.internal;

import net.samitkumar.multi_tenant_salon.website.WebsiteTheme;
import net.samitkumar.multi_tenant_salon.website.WebsiteType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
class WebsiteController {

    private final WebsiteThemeService service;

    WebsiteController(WebsiteThemeService service) {
        this.service = service;
    }

    record SaveThemeRequest(
            String heroBg,
            String heroTextColor,
            String accentColor,
            String fontFamily,
            String logoBgColor,
            String headerBg,
            String footerBg,
            String mapsUrl,
            String chatLayout,
            String chatBg
    ) {}

    record WebsiteTypeRequest(WebsiteType websiteType) {}
    record WebsiteTypeResponse(WebsiteType websiteType) {}

    @GetMapping({"/api/salon/{id}/website", "/api/salon-admin/{id}/website"})
    WebsiteTheme getTheme(@PathVariable UUID id) {
        return service.getTheme(id);
    }

    @PutMapping("/api/salon-admin/{id}/website")
    ResponseEntity<WebsiteTheme> saveTheme(@PathVariable UUID id, @RequestBody SaveThemeRequest req) {
        var theme = service.saveTheme(id, req.heroBg(), req.heroTextColor(),
                req.accentColor(), req.fontFamily(), req.logoBgColor(),
                req.headerBg(), req.footerBg(), req.mapsUrl(), req.chatLayout(), req.chatBg());
        return ResponseEntity.ok(theme);
    }

    @GetMapping("/api/salon-admin/{id}/website-type")
    WebsiteTypeResponse getWebsiteType(@PathVariable UUID id) {
        return new WebsiteTypeResponse(service.getWebsiteType(id));
    }

    @PatchMapping("/api/salon-admin/{id}/website-type")
    ResponseEntity<WebsiteTheme> updateWebsiteType(@PathVariable UUID id, @RequestBody WebsiteTypeRequest req) {
        return ResponseEntity.ok(service.updateWebsiteType(id, req.websiteType()));
    }
}
