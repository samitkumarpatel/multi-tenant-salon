package net.samitkumar.multi_tenant_saloon.website.internal;

import net.samitkumar.multi_tenant_saloon.website.WebsiteTheme;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/saloons")
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
            String logoBgColor
    ) {}

    @GetMapping("/{id}/theme")
    WebsiteTheme getTheme(@PathVariable UUID id) {
        return service.getTheme(id);
    }

    @PutMapping("/{id}/theme")
    ResponseEntity<WebsiteTheme> saveTheme(@PathVariable UUID id, @RequestBody SaveThemeRequest req) {
        var theme = service.saveTheme(id, req.heroBg(), req.heroTextColor(),
                req.accentColor(), req.fontFamily(), req.logoBgColor());
        return ResponseEntity.ok(theme);
    }
}
