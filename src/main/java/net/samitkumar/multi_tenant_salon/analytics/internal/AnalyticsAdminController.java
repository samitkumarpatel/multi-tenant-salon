package net.samitkumar.multi_tenant_salon.analytics.internal;

import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// Mounted under the {salonId}-templated /api/salon-admin/** prefix, so the ownership check in
// MultiTenantSalonApplication's security config already scopes every call to the caller's own
// salon (or a super-admin) before a request ever reaches here.
@RestController
@RequestMapping("/api/salon-admin/{salonId}/analytics")
class AnalyticsAdminController {

    private final SalonApi salonApi;
    private final AnalyticsSummaryService summaryService;

    AnalyticsAdminController(SalonApi salonApi, AnalyticsSummaryService summaryService) {
        this.salonApi = salonApi;
        this.summaryService = summaryService;
    }

    @GetMapping("/summary")
    ResponseEntity<AnalyticsSummary> summary(@PathVariable String salonId,
                                             @RequestParam(defaultValue = "7") int days) {
        var resolvedSalonId = salonApi.resolveId(salonId);
        boolean analyticsEnabled = salonApi.findById(resolvedSalonId)
                .map(AnalyticsAdminController::hasAnalyticsEnabled)
                .orElse(false);
        if (!analyticsEnabled) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        int clampedDays = Math.min(Math.max(days, 1), 90);
        return ResponseEntity.ok(summaryService.summarize(resolvedSalonId, clampedDays));
    }

    private static boolean hasAnalyticsEnabled(Salon salon) {
        return salon.features().stream().anyMatch(f -> f.feature() == SalonFeature.ANALYTICS);
    }
}
