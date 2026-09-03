package net.samitkumar.multi_tenant_salon.shop;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Embedded;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A customer order placed from the public shop. The order + its {@link OrderLine}s are written
 * once at checkout and never restructured afterwards; later changes are targeted column updates
 * (status) or inserts into the separate {@link OrderLineActivity} aggregate — so Spring Data
 * JDBC never re-inserts and renumbers the line rows that the admin timeline references.
 *
 * <p>Each line snapshots the product/variant name and unit price at purchase time so order
 * history survives later catalogue edits (the {@code product_id}/{@code variant_id} FKs are
 * {@code ON DELETE SET NULL}).
 */
@Table("shop_order")
public record ShopOrder(
        @Id Long id,
        UUID salonId,
        String orderNumber,
        String customerName,
        String customerEmail,
        String customerPhone,
        @Embedded(onEmpty = Embedded.OnEmpty.USE_NULL) ShippingAddress shippingAddress,
        OrderStatus status,
        PaymentStatus paymentStatus,
        String paymentReference,
        BigDecimal subtotal,
        String currency,
        Instant createdAt,
        String trackingCarrier,
        String trackingNumber,
        @MappedCollection(idColumn = "order_id", keyColumn = "order_key") List<OrderLine> lines
) {
    public ShopOrder {
        lines = lines != null ? List.copyOf(lines) : List.of();
        if (status == null) status = OrderStatus.NEW;
        if (paymentStatus == null) paymentStatus = PaymentStatus.PENDING;
    }

    public record ShippingAddress(
            @Column("ship_line1") String line1,
            @Column("ship_line2") String line2,
            @Column("ship_city") String city,
            @Column("ship_state") String state,
            @Column("ship_country") String country,
            @Column("ship_zip_code") String zipCode
    ) {}

    @Table("shop_order_line")
    public record OrderLine(
            @Id Long id,
            Long productId,
            Long variantId,
            String productName,
            String variantLabel,
            BigDecimal unitPrice,
            int quantity,
            BigDecimal lineTotal
    ) {}
}
