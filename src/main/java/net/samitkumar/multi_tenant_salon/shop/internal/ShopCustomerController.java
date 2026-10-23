package net.samitkumar.multi_tenant_salon.shop.internal;

import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.shop.Brand;
import net.samitkumar.multi_tenant_salon.shop.Category;
import net.samitkumar.multi_tenant_salon.shop.ShopOrder;
import net.samitkumar.multi_tenant_salon.shop.CommunicationPreference;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopManager.CheckoutItem;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopManager.CheckoutRequest;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopViews.OrderView;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopViews.ProductView;
import net.samitkumar.multi_tenant_salon.payments.PaymentGateway;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;

/**
 * Public, anonymous storefront — {@code /api/salon/{salonId}/shop/**}, covered by the security
 * config's {@code /api/salon/**} permit-all rule. Only active products/variants are exposed.
 * Salons with Shop payments enabled receive a connected-account Checkout Session; salons that
 * have not enabled Stripe retain the existing legacy checkout behavior.
 */
@RestController
@RequestMapping("/api/salon/{salonId}/shop")
class ShopCustomerController {

    private final ShopManager shop;
    private final SalonApi salonApi;
    private final PaymentGateway stripe;

    ShopCustomerController(ShopManager shop, SalonApi salonApi, PaymentGateway stripe) {
        this.shop = shop;
        this.salonApi = salonApi;
        this.stripe = stripe;
    }

    record CheckoutBody(String customerName, String customerEmail, String customerPhone,
                        ShopOrder.ShippingAddress shippingAddress, List<CheckoutItem> items,
                        CommunicationPreference communicationPreference, String returnUrl, Boolean inlineCheckout) {}
    /** {@code checkoutUrl} for a redirect checkout; {@code checkout} also covers the in-page payment form. */
    record CheckoutResponse(OrderView order, String checkoutUrl, PaymentGateway.Checkout checkout) {}
    /** What the storefront checkout needs to know before the customer pays. */
    record CheckoutOptions(boolean onlinePayment) {}

    /**
     * Whether placing an order hands the customer to Stripe Checkout (Shop payments enabled on a
     * connected account that can charge) — so the checkout page can tell the customer what happens next.
     */
    @GetMapping("/checkout-options")
    CheckoutOptions checkoutOptions(@PathVariable String salonId) {
        return new CheckoutOptions(stripe.enabled(salonApi.resolveId(salonId), "SHOP"));
    }

    @GetMapping("/brands")
    List<Brand> listBrands(@PathVariable String salonId) {
        return shop.listPublicBrands(salonApi.resolveId(salonId));
    }

    @GetMapping("/categories")
    List<Category> listCategories(@PathVariable String salonId) {
        return shop.listPublicCategories(salonApi.resolveId(salonId));
    }

    @GetMapping("/products")
    List<ProductView> listProducts(@PathVariable String salonId,
                                   @RequestParam(required = false) Long brandId,
                                   @RequestParam(required = false) Long categoryId) {
        return shop.listProducts(salonApi.resolveId(salonId), true, brandId, categoryId);
    }

    @GetMapping("/products/{productId}")
    ResponseEntity<ProductView> getProduct(@PathVariable String salonId, @PathVariable Long productId) {
        return shop.getProduct(salonApi.resolveId(salonId), productId, true)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Deliberately not {@code @Transactional}: {@code placeOrder} commits the PENDING order and its
     * stock decrement on its own, and only then do we call Stripe. Creating the Checkout Session
     * inside the transaction would pin a database connection across an external network call, and —
     * because a Stripe session cannot be rolled back — a commit failure after it would leave a live,
     * payable session with no order behind it. With the commit first, the catch below is a real
     * compensation that survives; inside a transaction it would simply roll back with everything else.
     */
    @PostMapping("/orders")
    ResponseEntity<?> checkout(@PathVariable String salonId, @RequestBody CheckoutBody body) {
        var id = salonApi.resolveId(salonId);
        boolean stripeEnabled = stripe.enabled(id, "SHOP");
        var order = shop.placeOrder(id, new CheckoutRequest(
                body.customerName(), body.customerEmail(), body.customerPhone(),
                body.shippingAddress(), body.items(), body.communicationPreference()), stripeEnabled);
        var location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(order.id()).toUri();
        if (!stripeEnabled) return ResponseEntity.created(location).body(order);
        PaymentGateway.Checkout checkout;
        try {
            checkout = stripe.createCheckout(id, new PaymentGateway.CheckoutRequest("SHOP", String.valueOf(order.id()),
                    order.subtotal(), order.currency(), "Order " + order.orderNumber(), body.returnUrl(),
                    body.customerEmail(), Boolean.TRUE.equals(body.inlineCheckout())));
        } catch (RuntimeException error) {
            shop.recordStripePayment(id, order.id(), "checkout-creation-failed", false);
            throw error;
        }
        return ResponseEntity.created(location).body(new CheckoutResponse(order, checkout.url(), checkout));
    }
}
