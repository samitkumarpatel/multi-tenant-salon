package net.samitkumar.multi_tenant_salon.chat.internal;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;

/**
 * Calls this application's own public salon API — the same endpoints the Static Website uses —
 * so the AI assistant's data is always identical to what's rendered on the public site.
 */
@HttpExchange("/api/salon")
interface SalonApiClient {

    @GetExchange("/{salonId}")
    String getSalon(@PathVariable String salonId);

    @GetExchange("/{salonId}/staff")
    String getStaff(@PathVariable String salonId);

    @GetExchange("/{salonId}/services")
    String getServices(@PathVariable String salonId);

    @GetExchange("/{salonId}/holidays")
    String getHolidays(@PathVariable String salonId);

    @GetExchange("/{salonId}/slots")
    String getSlots(@PathVariable String salonId, @RequestParam Long serviceId,
                     @RequestParam String date, @RequestParam(required = false) Long staffId);
}
