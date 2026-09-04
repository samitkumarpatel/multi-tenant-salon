package net.samitkumar.multi_tenant_salon.shop.internal;

import net.samitkumar.multi_tenant_salon.shop.CommunicationPreference;
import net.samitkumar.multi_tenant_salon.shop.OrderLineActivity;
import net.samitkumar.multi_tenant_salon.shop.OrderStatus;
import net.samitkumar.multi_tenant_salon.shop.PaymentStatus;
import net.samitkumar.multi_tenant_salon.shop.ProductVariant;
import net.samitkumar.multi_tenant_salon.shop.ShopOrder;
import net.samitkumar.multi_tenant_salon.shop.ShopOrderActivity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

final class ShopViews {
    private ShopViews() {}

    record ProductView(
            Long id, UUID salonId, Long brandId, String brandName, Long categoryId, String categoryName,
            String name, String description, String imageUrl, List<String> images,
            boolean active, Instant createdAt, List<ProductVariant> variants
    ) {}

    record InventoryRow(
            Long variantId, Long productId, String productName, boolean productActive,
            String sku, String label, BigDecimal price, String currency,
            int quantityOnHand, int reorderLevel, boolean active
    ) {
        boolean low() { return active && quantityOnHand <= reorderLevel; }
    }

    record OrderLineView(
            Long id, Long productId, Long variantId, String productName, String variantLabel,
            BigDecimal unitPrice, int quantity, BigDecimal lineTotal, List<OrderLineActivity> activities
    ) {}

    record OrderView(
            Long id, UUID salonId, String orderNumber, String customerName, String customerEmail,
            String customerPhone, ShopOrder.ShippingAddress shippingAddress,
            OrderStatus status, PaymentStatus paymentStatus, String paymentReference,
            BigDecimal subtotal, String currency, Instant createdAt,
            String trackingCarrier, String trackingNumber,
            CommunicationPreference communicationPreference,
            BigDecimal refundAmount, String refundReason, String refundStatus,
            String returnStatus, String returnReason, String returnNotes, Instant returnUpdatedAt,
            String creditNoteRef, String creditNoteStatus, Instant creditNoteAt,
            List<OrderLineView> lines, List<ShopOrderActivity> activities
    ) {}

    record OrderPage(
            List<OrderView> content, int page, int size, long totalElements, int totalPages,
            Map<OrderStatus, Long> statusCounts
    ) {}
}
