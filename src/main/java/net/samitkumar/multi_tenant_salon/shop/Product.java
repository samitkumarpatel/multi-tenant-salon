package net.samitkumar.multi_tenant_salon.shop;

import com.fasterxml.jackson.annotation.JsonValue;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A shop product. Its purchasable options (price, SKU, stock) live in {@link ProductVariant},
 * which is a <em>separate</em> aggregate — not a {@code @MappedCollection} here — so editing a
 * product never re-inserts (and thus renumbers) variant rows that order lines and inventory
 * counts point at. {@code ShopManager} stitches the two together for the API.
 *
 * <p>{@code imageUrl} is the cover image and always mirrors {@code images[0]}. {@code images}
 * is the ordered gallery (child table {@code product_image}); it is safe to re-insert on every
 * save since nothing holds a foreign key to those rows.
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
        Instant createdAt,
        @MappedCollection(idColumn = "product_id") List<ProductImage> images
) {
    public Product {
        images = images != null ? List.copyOf(images) : List.of();
    }

    /** A single gallery image URL. Serializes as a plain string (JSON: {@code "https://…"}). */
    @Table("product_image")
    public record ProductImage(@JsonValue String value) {}
}
