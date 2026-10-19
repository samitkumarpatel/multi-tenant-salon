package net.samitkumar.multi_tenant_salon.mcp.internal;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;

import java.util.List;

/**
 * Calls the public storefront so the shop app sees exactly what the website shop shows (active
 * products/variants only) and checkout shares its stock, payment and notification rules.
 */
@HttpExchange("/api/salon/{salonId}/shop")
interface SalonMcpShopClient {
    record Item(Long variantId, int quantity) {}

    record Address(String line1, String line2, String city, String state, String country, String zipCode) {}

    record CheckoutRequest(String customerName, String customerEmail, String customerPhone,
                           Address shippingAddress, List<Item> items,
                           String communicationPreference, String returnUrl) {}

    @GetExchange("/products")
    String products(@PathVariable String salonId);

    @GetExchange("/categories")
    String categories(@PathVariable String salonId);

    @GetExchange("/brands")
    String brands(@PathVariable String salonId);

    @PostExchange("/orders")
    String placeOrder(@PathVariable String salonId, @RequestBody CheckoutRequest request);
}
