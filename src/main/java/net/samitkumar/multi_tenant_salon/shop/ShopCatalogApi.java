package net.samitkumar.multi_tenant_salon.shop;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Read/write boundary used by the in-salon checkout without exposing shop internals. */
public interface ShopCatalogApi {
    record CatalogItem(Long variantId, Long productId, String name, String variantLabel,
                       BigDecimal price, String currency, int quantityOnHand) {}

    List<CatalogItem> findAvailableItems(UUID salonId);
    Optional<CatalogItem> findAvailableItem(UUID salonId, Long variantId);
    void decrementStock(UUID salonId, Long variantId, int quantity);
}
