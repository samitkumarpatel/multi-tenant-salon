package net.samitkumar.multi_tenant_salon.shop.internal;

import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.shop.Brand;
import net.samitkumar.multi_tenant_salon.shop.Category;
import net.samitkumar.multi_tenant_salon.shop.ShopOrder;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopManager.CheckoutItem;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopManager.CheckoutRequest;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopViews.OrderView;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopViews.ProductView;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;

/**
 * Public, anonymous storefront — {@code /api/salon/{salonId}/shop/**}, covered by the security
 * config's {@code /api/salon/**} permit-all rule. Only active products/variants are exposed, and
 * checkout runs an atomic stock decrement + a dummy payment step.
 */
@RestController
@RequestMapping("/api/salon/{salonId}/shop")
class ShopCustomerController {

    private final ShopManager shop;
    private final SalonApi salonApi;

    ShopCustomerController(ShopManager shop, SalonApi salonApi) {
        this.shop = shop;
        this.salonApi = salonApi;
    }

    record CheckoutBody(String customerName, String customerEmail, String customerPhone,
                        ShopOrder.ShippingAddress shippingAddress, List<CheckoutItem> items) {}

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

    @PostMapping("/orders")
    ResponseEntity<OrderView> checkout(@PathVariable String salonId, @RequestBody CheckoutBody body) {
        var order = shop.placeOrder(salonApi.resolveId(salonId), new CheckoutRequest(
                body.customerName(), body.customerEmail(), body.customerPhone(),
                body.shippingAddress(), body.items()));
        var location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(order.id()).toUri();
        return ResponseEntity.created(location).body(order);
    }
}
