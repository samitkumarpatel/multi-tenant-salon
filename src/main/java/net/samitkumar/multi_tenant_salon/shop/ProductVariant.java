package net.samitkumar.multi_tenant_salon.shop;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * One purchasable option of a {@link Product} — carries its own price, SKU and stock count.
 * A single-option product still has exactly one variant. {@code salonId} is denormalised so the
 * inventory screen and checkout guards can query/lock variants without joining through
 * {@code product}.
 */
@Table("product_variant")
public record ProductVariant(
        @Id Long id,
        Long productId,
        UUID salonId,
        String sku,
        String label,
        BigDecimal price,
        BigDecimal compareAtPrice,
        String currency,
        int quantityOnHand,
        int reorderLevel,
        boolean active
) {}
