package net.samitkumar.multi_tenant_salon.shop.internal;

import net.samitkumar.multi_tenant_salon.shop.OrderLineActivity;
import net.samitkumar.multi_tenant_salon.shop.ShopOrderActivity;
import net.samitkumar.multi_tenant_salon.shop.OrderStatus;
import net.samitkumar.multi_tenant_salon.shop.PaymentStatus;
import net.samitkumar.multi_tenant_salon.shop.ProductVariant;
import net.samitkumar.multi_tenant_salon.shop.ShopOrder;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Read-side shapes the controllers return — {@link net.samitkumar.multi_tenant_salon.shop.Product}
 *  and its variants stitched together, orders with their per-line activity timeline attached. */
final class ShopViews {
    private ShopViews() {}

    record ProductView(
            Long id,
            UUID salonId,
            Long brandId,
            String brandName,
            Long categoryId,
            String categoryName,
            String name,
            String description,
            String imageUrl,
            boolean active,
            Instant createdAt,
            List<ProductVariant> variants
    ) {}

    record InventoryRow(
            Long variantId,
            Long productId,
            String productName,
            boolean productActive,
            String sku,
            String label,
            BigDecimal price,
            String currency,
            int quantityOnHand,
            int reorderLevel,
            boolean active
    ) {
        boolean low() { return active && quantityOnHand <= reorderLevel; }
    }

    record OrderLineView(
            Long id,
            Long productId,
            Long variantId,
            String productName,
            String variantLabel,
            BigDecimal unitPrice,
            int quantity,
            BigDecimal lineTotal,
            List<OrderLineActivity> activities
    ) {}

    record OrderView(
            Long id,
            UUID salonId,
            String orderNumber,
            String customerName,
            String customerEmail,
            String customerPhone,
            ShopOrder.ShippingAddress shippingAddress,
            OrderStatus status,
            PaymentStatus paymentStatus,
            String paymentReference,
            BigDecimal subtotal,
            String currency,
            Instant createdAt,
            String trackingCarrier,
            String trackingNumber,
            List<OrderLineView> lines,
            List<ShopOrderActivity> activities
    ) {}
}
