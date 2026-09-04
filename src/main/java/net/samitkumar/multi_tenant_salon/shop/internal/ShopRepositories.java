package net.samitkumar.multi_tenant_salon.shop.internal;

import net.samitkumar.multi_tenant_salon.shop.Brand;
import net.samitkumar.multi_tenant_salon.shop.Category;
import net.samitkumar.multi_tenant_salon.shop.OrderLineActivity;
import net.samitkumar.multi_tenant_salon.shop.Product;
import net.samitkumar.multi_tenant_salon.shop.ProductVariant;
import net.samitkumar.multi_tenant_salon.shop.ShopOrder;
import net.samitkumar.multi_tenant_salon.shop.ShopOrderActivity;
import org.springframework.data.repository.ListCrudRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface BrandRepository extends ListCrudRepository<Brand, Long> {
    List<Brand> findBySalonIdOrderByNameAsc(UUID salonId);
    Optional<Brand> findByIdAndSalonId(Long id, UUID salonId);
}

interface CategoryRepository extends ListCrudRepository<Category, Long> {
    List<Category> findBySalonIdOrderByNameAsc(UUID salonId);
    Optional<Category> findByIdAndSalonId(Long id, UUID salonId);
}

interface ProductRepository extends ListCrudRepository<Product, Long> {
    List<Product> findBySalonIdOrderByCreatedAtDesc(UUID salonId);
    List<Product> findBySalonIdAndActiveOrderByCreatedAtDesc(UUID salonId, boolean active);
    Optional<Product> findByIdAndSalonId(Long id, UUID salonId);
}

interface ProductVariantRepository extends ListCrudRepository<ProductVariant, Long> {
    List<ProductVariant> findBySalonId(UUID salonId);
    List<ProductVariant> findByProductId(Long productId);
    Optional<ProductVariant> findByIdAndSalonId(Long id, UUID salonId);
    void deleteByProductId(Long productId);
}

interface ShopOrderRepository extends ListCrudRepository<ShopOrder, Long> {
    List<ShopOrder> findBySalonIdOrderByCreatedAtDesc(UUID salonId);
    Optional<ShopOrder> findByIdAndSalonId(Long id, UUID salonId);
    Optional<ShopOrder> findByOrderNumberAndSalonId(String orderNumber, UUID salonId);
}

interface OrderLineActivityRepository extends ListCrudRepository<OrderLineActivity, Long> {
    List<OrderLineActivity> findByOrderLineIdInOrderByCreatedAtAsc(Collection<Long> orderLineIds);
}

interface ShopOrderActivityRepository extends ListCrudRepository<ShopOrderActivity, Long> {
    List<ShopOrderActivity> findByOrderIdOrderByCreatedAtAsc(Long orderId);
}
