package net.samitkumar.multi_tenant_salon.salon.internal;

import jakarta.validation.Valid;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
class LanguageSettingsController {
    private final SalonApi salons;
    private final LanguageSettingsService settings;

    LanguageSettingsController(SalonApi salons, LanguageSettingsService settings) {
        this.salons = salons;
        this.settings = settings;
    }

    @GetMapping({"/api/salon/{salonId}/languages", "/api/salon-admin/{salonId}/languages"})
    ResponseEntity<LanguageSettings> get(@PathVariable String salonId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(settings.get(salons.resolveId(salonId)));
    }

    @PutMapping("/api/salon-admin/{salonId}/languages")
    LanguageSettings save(@PathVariable String salonId, @Valid @RequestBody LanguageSettings request) {
        return settings.save(salons.resolveId(salonId), request);
    }
}
