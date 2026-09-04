package net.samitkumar.multi_tenant_salon.shop.internal;

import net.samitkumar.multi_tenant_salon.media.MediaService;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.shop.Brand;
import net.samitkumar.multi_tenant_salon.shop.Category;
import net.samitkumar.multi_tenant_salon.shop.OrderStatus;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopManager.VariantSpec;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopViews.InventoryRow;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopViews.OrderPage;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopViews.OrderView;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopViews.ProductView;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Owner/admin surface for the shop — full control of brands, categories, products (with their
 * variants), inventory, and orders. All paths are {@code /api/salon-admin/{salonId}/shop/**} and
 * are owner-gated by the security config's {@code /api/salon-admin/{salonId}/**} rule.
 */
@RestController
@RequestMapping("/api/salon-admin/{salonId}/shop")
class ShopAdminController {

    private final ShopManager shop;
    private final SalonApi salonApi;
    private final MediaService mediaApi;

    ShopAdminController(ShopManager shop, SalonApi salonApi, Optional<MediaService> mediaApi) {
        this.shop = shop;
        this.salonApi = salonApi;
        this.mediaApi = mediaApi.orElse(null);
    }

    // ── request bodies ───────────────────────────────────────────────────────

    record BrandRequest(String name, String description, String logoUrl, Boolean active) {}

    record CategoryRequest(String name, String description, Boolean active) {}

    record ProductRequest(Long brandId, Long categoryId, String name, String description,
                          String imageUrl, List<String> images, Boolean active, List<VariantSpec> variants) {}

    record InventoryRequest(Integer quantityOnHand, Integer reorderLevel) {}

    record StatusRequest(OrderStatus status) {}

    record NoteRequest(String note) {}

    record NotifyRequest(String message) {}

    record WorkNoteRequest(String note) {}

    record ImageUploadRequest(String contentType) {}

    // ── brands ───────────────────────────────────────────────────────────────

    @GetMapping("/brands")
    List<Brand> listBrands(@PathVariable String salonId) {
        return shop.listBrands(salonApi.resolveId(salonId));
    }

    @PostMapping("/brands")
    ResponseEntity<Brand> addBrand(@PathVariable String salonId, @RequestBody BrandRequest req) {
        var brand = shop.addBrand(salonApi.resolveId(salonId), req.name(), req.description(), req.logoUrl());
        return created(brand, brand.id());
    }

    @PutMapping("/brands/{brandId}")
    ResponseEntity<Brand> updateBrand(@PathVariable String salonId, @PathVariable Long brandId,
                                      @RequestBody BrandRequest req) {
        return shop.updateBrand(salonApi.resolveId(salonId), brandId, req.name(), req.description(),
                        req.logoUrl(), req.active() == null || req.active())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/brands/{brandId}")
    ResponseEntity<Void> deleteBrand(@PathVariable String salonId, @PathVariable Long brandId) {
        shop.deleteBrand(salonApi.resolveId(salonId), brandId);
        return ResponseEntity.noContent().build();
    }

    // ── categories ───────────────────────────────────────────────────────────

    @GetMapping("/categories")
    List<Category> listCategories(@PathVariable String salonId) {
        return shop.listCategories(salonApi.resolveId(salonId));
    }

    @PostMapping("/categories")
    ResponseEntity<Category> addCategory(@PathVariable String salonId, @RequestBody CategoryRequest req) {
        var category = shop.addCategory(salonApi.resolveId(salonId), req.name(), req.description());
        return created(category, category.id());
    }

    @PutMapping("/categories/{categoryId}")
    ResponseEntity<Category> updateCategory(@PathVariable String salonId, @PathVariable Long categoryId,
                                            @RequestBody CategoryRequest req) {
        return shop.updateCategory(salonApi.resolveId(salonId), categoryId, req.name(), req.description(),
                        req.active() == null || req.active())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/categories/{categoryId}")
    ResponseEntity<Void> deleteCategory(@PathVariable String salonId, @PathVariable Long categoryId) {
        shop.deleteCategory(salonApi.resolveId(salonId), categoryId);
        return ResponseEntity.noContent().build();
    }

    // ── products ─────────────────────────────────────────────────────────────

    @GetMapping("/products")
    List<ProductView> listProducts(@PathVariable String salonId) {
        return shop.listProducts(salonApi.resolveId(salonId), false);
    }

    @GetMapping("/products/{productId}")
    ResponseEntity<ProductView> getProduct(@PathVariable String salonId, @PathVariable Long productId) {
        return shop.getProduct(salonApi.resolveId(salonId), productId, false)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/products")
    ResponseEntity<ProductView> addProduct(@PathVariable String salonId, @RequestBody ProductRequest req) {
        var product = shop.addProduct(salonApi.resolveId(salonId), req.brandId(), req.categoryId(), req.name(),
                req.description(), req.imageUrl(), req.images(), req.variants());
        return created(product, product.id());
    }

    @PutMapping("/products/{productId}")
    ResponseEntity<ProductView> updateProduct(@PathVariable String salonId, @PathVariable Long productId,
                                              @RequestBody ProductRequest req) {
        return shop.updateProduct(salonApi.resolveId(salonId), productId, req.brandId(), req.categoryId(),
                        req.name(), req.description(), req.imageUrl(), req.images(),
                        req.active() == null || req.active(), req.variants())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/products/{productId}")
    ResponseEntity<Void> deleteProduct(@PathVariable String salonId, @PathVariable Long productId) {
        shop.deleteProduct(salonApi.resolveId(salonId), productId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/products/{productId}/image-upload-url")
    ResponseEntity<MediaService.PresignedUpload> productImageUploadUrl(@PathVariable String salonId,
                                                                      @PathVariable Long productId,
                                                                      @RequestBody ImageUploadRequest req) {
        if (mediaApi == null) return ResponseEntity.status(503).build();
        return shop.getProduct(salonApi.resolveId(salonId), productId, false)
                .map(p -> ResponseEntity.ok(mediaApi.generateProductImageUploadUrl(productId, req.contentType())))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // ── inventory ────────────────────────────────────────────────────────────

    @GetMapping("/inventory")
    List<InventoryRow> listInventory(@PathVariable String salonId) {
        return shop.listInventory(salonApi.resolveId(salonId));
    }

    @PutMapping("/inventory/{variantId}")
    ResponseEntity<InventoryRow> updateInventory(@PathVariable String salonId, @PathVariable Long variantId,
                                                 @RequestBody InventoryRequest req) {
        return shop.updateInventory(salonApi.resolveId(salonId), variantId,
                        req.quantityOnHand() == null ? 0 : req.quantityOnHand(),
                        req.reorderLevel() == null ? 0 : req.reorderLevel())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // ── orders ───────────────────────────────────────────────────────────────

    @GetMapping("/orders")
    OrderPage listOrders(@PathVariable String salonId,
                         @RequestParam(required = false) String q,
                         @RequestParam(required = false) OrderStatus status,
                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                         @RequestParam(defaultValue = "newest") String sort,
                         @RequestParam(defaultValue = "0") int page,
                         @RequestParam(defaultValue = "20") int size) {
        return shop.listOrders(salonApi.resolveId(salonId), q, status, from, to, sort, page, size);
    }

    @GetMapping("/orders/{orderId}")
    ResponseEntity<OrderView> getOrder(@PathVariable String salonId, @PathVariable Long orderId) {
        return shop.getOrder(salonApi.resolveId(salonId), orderId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/orders/{orderId}/status")
    ResponseEntity<OrderView> updateOrderStatus(@PathVariable String salonId, @PathVariable Long orderId,
                                                @RequestBody StatusRequest req) {
        return shop.updateOrderStatus(salonApi.resolveId(salonId), orderId, req.status(), "admin")
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/orders/{orderId}/lines/{lineId}/notify")
    ResponseEntity<OrderView> notifyUser(@PathVariable String salonId, @PathVariable Long orderId,
                                         @PathVariable Long lineId,
                                         @RequestBody(required = false) NotifyRequest req) {
        return shop.notifyUserForLine(salonApi.resolveId(salonId), orderId, lineId,
                        req != null && req.message() != null && !req.message().isBlank() ? req.message() : null, "admin")
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/orders/{orderId}/invoice")
    ResponseEntity<OrderView> sendInvoice(@PathVariable String salonId, @PathVariable Long orderId) {
        return shop.sendInvoice(salonApi.resolveId(salonId), orderId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/orders/{orderId}/work-note")
    ResponseEntity<OrderView> addWorkNote(@PathVariable String salonId, @PathVariable Long orderId,
                                          @RequestBody WorkNoteRequest req) {
        return shop.addWorkNote(salonApi.resolveId(salonId), orderId, req.note())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    record ShippingRequest(String carrier, String trackingNumber) {}

    @PostMapping("/orders/{orderId}/shipping")
    ResponseEntity<OrderView> addShipping(@PathVariable String salonId, @PathVariable Long orderId,
                                          @RequestBody ShippingRequest req) {
        return shop.addShipping(salonApi.resolveId(salonId), orderId, req.carrier(), req.trackingNumber())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    record CustomerNotifyRequest(String message) {}

    @PostMapping("/orders/{orderId}/notify")
    ResponseEntity<OrderView> notifyCustomer(@PathVariable String salonId, @PathVariable Long orderId,
                                             @RequestBody CustomerNotifyRequest req) {
        return shop.notifyCustomer(salonApi.resolveId(salonId), orderId, req.message())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/orders/{orderId}/lines/{lineId}/notes")
    ResponseEntity<OrderView> addNote(@PathVariable String salonId, @PathVariable Long orderId,
                                      @PathVariable Long lineId, @RequestBody NoteRequest req) {
        return shop.addNoteToLine(salonApi.resolveId(salonId), orderId, lineId, req.note(), "admin")
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // ── refunds (inline on order) ─────────────────────────────────────────────

    record RefundRequest(BigDecimal amount, String reason) {}

    @GetMapping("/refunds")
    List<OrderView> listRefunds(@PathVariable String salonId) {
        return shop.listRefunds(salonApi.resolveId(salonId));
    }

    @PostMapping("/orders/{orderId}/refunds")
    OrderView createRefund(@PathVariable String salonId, @PathVariable Long orderId,
                           @RequestBody RefundRequest req) {
        return shop.createRefund(salonApi.resolveId(salonId), orderId, req.amount(), req.reason());
    }

    @PostMapping("/orders/{orderId}/refunds/approve")
    OrderView approveRefund(@PathVariable String salonId, @PathVariable Long orderId) {
        return shop.approveRefund(salonApi.resolveId(salonId), orderId);
    }

    @PostMapping("/orders/{orderId}/refunds/accept")
    OrderView acceptRefund(@PathVariable String salonId, @PathVariable Long orderId) {
        return shop.acceptRefund(salonApi.resolveId(salonId), orderId);
    }

    @PostMapping("/orders/{orderId}/refunds/reject")
    OrderView rejectRefund(@PathVariable String salonId, @PathVariable Long orderId) {
        return shop.rejectRefund(salonApi.resolveId(salonId), orderId);
    }

    // ── credit note (inline on order) ─────────────────────────────────────────

    @GetMapping("/credit-notes")
    List<OrderView> listCreditNoteOrders(@PathVariable String salonId) {
        return shop.listCreditNoteOrders(salonApi.resolveId(salonId));
    }

    @PostMapping("/orders/{orderId}/credit-note/pay")
    OrderView payCreditNote(@PathVariable String salonId, @PathVariable Long orderId) {
        return shop.payCreditNote(salonApi.resolveId(salonId), orderId);
    }

    // ── returns (inline on order) ─────────────────────────────────────────────

    record ReturnRequest(String reason) {}

    record ReturnStatusRequest(String status, String notes) {}

    @GetMapping("/returns")
    List<OrderView> listReturns(@PathVariable String salonId) {
        return shop.listReturns(salonApi.resolveId(salonId));
    }

    @PostMapping("/orders/{orderId}/returns")
    OrderView createReturn(@PathVariable String salonId, @PathVariable Long orderId,
                           @RequestBody ReturnRequest req) {
        return shop.createReturn(salonApi.resolveId(salonId), orderId, req.reason());
    }

    @PostMapping("/orders/{orderId}/returns/status")
    OrderView updateReturnStatus(@PathVariable String salonId, @PathVariable Long orderId,
                                 @RequestBody ReturnStatusRequest req) {
        return shop.updateReturnStatus(salonApi.resolveId(salonId), orderId, req.status(), req.notes());
    }

    // ── helper ───────────────────────────────────────────────────────────────

    private static <T> ResponseEntity<T> created(T body, Long id) {
        var location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(id).toUri();
        return ResponseEntity.created(location).body(body);
    }
}
