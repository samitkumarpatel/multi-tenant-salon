package net.samitkumar.multi_tenant_salon.mcp.internal;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;

/**
 * Calls the public membership API so the app shows exactly the plans the website shows and
 * sign-up shares its capacity, duplicate and Stripe rules.
 */
@HttpExchange("/api/salon/{salonId}/membership")
interface SalonMcpMembershipClient {
    record CheckoutRequest(Long planId, String customerName, String customerEmail, String customerPhone, String returnUrl) {}

    @GetExchange("/plans")
    String plans(@PathVariable String salonId);

    @PostExchange("/checkout")
    String checkout(@PathVariable String salonId, @RequestBody CheckoutRequest request);
}
