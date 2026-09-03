package net.samitkumar.multi_tenant_salon.shop;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * A shop product. Its purchasable options (price, SKU, stock) live in {@link ProductVariant},
 * which is a <em>separate</em> aggregate — not a {@code @MappedCollection} here — so editing a
 * product never re-inserts (and thus renumbers) variant rows that order lines and inventory
 * counts point at. {@code ShopManager} stitches the two together for the API.
 */
@Table("product")
public record Product(
        @Id Long id,
        UUID salonId,
        Long brandId,
        Long categoryId,
        String name,
        String description,
        String imageUrl,
        boolean active,
        Instant createdAt
) {}
