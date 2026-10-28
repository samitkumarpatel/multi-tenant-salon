package net.samitkumar.multi_tenant_salon.website.internal;

import tools.jackson.databind.JsonNode;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.website.WebsiteTheme;
import net.samitkumar.multi_tenant_salon.website.WebsiteType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
class WebsiteController {

    private final WebsiteThemeService service;
    private final SalonApi salonApi;

    WebsiteController(WebsiteThemeService service, SalonApi salonApi) {
        this.service = service;
        this.salonApi = salonApi;
    }

    record SaveThemeRequest(
            String heroBg,
            String heroTextColor,
            String accentColor,
            String fontFamily,
            String logoBgColor,
            String headerBg,
            String footerBg,
            String chatLayout,
            String chatBg,
            JsonNode footerLinks
    ) {}

    /** Only an object is stored; anything else (absent, null, array) falls back to the defaults. */
    private static String footerLinksJson(JsonNode node) {
        return node != null && node.isObject() ? node.toString() : null;
    }

    record WebsiteTypeRequest(WebsiteType websiteType) {}
    record WebsiteTypeResponse(WebsiteType websiteType) {}

    @GetMapping({"/api/salon/{id}/website", "/api/salon-admin/{id}/website"})
    WebsiteTheme getTheme(@PathVariable String id) {
        return service.getTheme(salonApi.resolveId(id));
    }

    @PutMapping("/api/salon-admin/{id}/website")
    ResponseEntity<WebsiteTheme> saveTheme(@PathVariable String id, @RequestBody SaveThemeRequest req) {
        var theme = service.saveTheme(salonApi.resolveId(id), req.heroBg(), req.heroTextColor(),
                req.accentColor(), req.fontFamily(), req.logoBgColor(),
                req.headerBg(), req.footerBg(), req.chatLayout(), req.chatBg(),
                footerLinksJson(req.footerLinks()));
        return ResponseEntity.ok(theme);
    }

    @GetMapping("/api/salon-admin/{id}/website-type")
    WebsiteTypeResponse getWebsiteType(@PathVariable String id) {
        return new WebsiteTypeResponse(service.getWebsiteType(salonApi.resolveId(id)));
    }

    @PatchMapping("/api/salon-admin/{id}/website-type")
    ResponseEntity<WebsiteTheme> updateWebsiteType(@PathVariable String id, @RequestBody WebsiteTypeRequest req) {
        return ResponseEntity.ok(service.updateWebsiteType(salonApi.resolveId(id), req.websiteType()));
    }
}
