package net.samitkumar.multi_tenant_salon.website.internal;

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
            String mapsUrl,
            String chatLayout,
            String chatBg
    ) {}

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
                req.headerBg(), req.footerBg(), req.mapsUrl(), req.chatLayout(), req.chatBg());
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
