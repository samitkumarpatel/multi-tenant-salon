package net.samitkumar.multi_tenant_salon.shop.internal;

import net.samitkumar.multi_tenant_salon.shop.Product;
import net.samitkumar.multi_tenant_salon.shop.ProductVariant;
import net.samitkumar.multi_tenant_salon.shop.ShopCatalogApi;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
class ShopCatalogService implements ShopCatalogApi {
    private final ProductRepository products;
    private final ProductVariantRepository variants;
    private final JdbcClient jdbc;

    ShopCatalogService(ProductRepository products, ProductVariantRepository variants, JdbcTemplate template) {
        this.products = products;
        this.variants = variants;
        this.jdbc = JdbcClient.create(template);
    }

    @Override
    public List<CatalogItem> findAvailableItems(UUID salonId) {
        Map<Long, Product> byId = products.findBySalonIdAndActiveOrderByCreatedAtDesc(salonId, true).stream()
                .collect(Collectors.toMap(Product::id, p -> p));
        return variants.findBySalonId(salonId).stream()
                .filter(ProductVariant::active)
                .filter(v -> v.quantityOnHand() > 0)
                .filter(v -> byId.containsKey(v.productId()))
                .map(v -> toItem(byId.get(v.productId()), v))
                .toList();
    }

    @Override
    public Optional<CatalogItem> findAvailableItem(UUID salonId, Long variantId) {
        return variants.findByIdAndSalonId(variantId, salonId)
                .filter(ProductVariant::active)
                .filter(v -> v.quantityOnHand() > 0)
                .flatMap(v -> products.findByIdAndSalonId(v.productId(), salonId)
                        .filter(Product::active)
                        .map(p -> toItem(p, v)));
    }

    @Override
    public void decrementStock(UUID salonId, Long variantId, int quantity) {
        int updated = jdbc.sql("UPDATE product_variant SET quantity_on_hand = quantity_on_hand - :qty " +
                        "WHERE id = :id AND salon_id = :salon AND active = TRUE AND quantity_on_hand >= :qty")
                .param("qty", quantity).param("id", variantId).param("salon", salonId).update();
        if (updated != 1) throw new ResponseStatusException(HttpStatus.CONFLICT, "Product is out of stock");
    }

    @Override
    public void incrementStock(UUID salonId, Long variantId, int quantity) {
        jdbc.sql("UPDATE product_variant SET quantity_on_hand = quantity_on_hand + :qty WHERE id = :id AND salon_id = :salon")
                .param("qty", quantity).param("id", variantId).param("salon", salonId).update();
    }

    private CatalogItem toItem(Product product, ProductVariant variant) {
        return new CatalogItem(variant.id(), product.id(), product.name(), variant.label(), variant.price(),
                variant.currency(), variant.quantityOnHand());
    }
}
