package net.samitkumar.multi_tenant_salon.shop.internal;

import net.samitkumar.multi_tenant_salon.shop.Brand;
import net.samitkumar.multi_tenant_salon.shop.Category;
import net.samitkumar.multi_tenant_salon.shop.OrderLineActivity;
import net.samitkumar.multi_tenant_salon.shop.Product;
import net.samitkumar.multi_tenant_salon.shop.ProductVariant;
import net.samitkumar.multi_tenant_salon.shop.ShippingMethod;
import net.samitkumar.multi_tenant_salon.shop.ShopOrder;
import net.samitkumar.multi_tenant_salon.shop.ShopOrderActivity;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
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

    @Query("SELECT * FROM shop_order WHERE salon_id = :salonId AND lower(customer_email) = lower(:email) ORDER BY created_at DESC")
    List<ShopOrder> findByCustomerEmail(UUID salonId, String email);

    @Modifying
    @Query("""
            UPDATE shop_order SET customer_name = 'Deleted customer', customer_email = :replacement, customer_phone = NULL,
                   ship_line1 = NULL, ship_line2 = NULL, ship_city = NULL, ship_state = NULL, ship_country = NULL, ship_zip_code = NULL
            WHERE salon_id = :salonId AND lower(customer_email) = lower(:email)""")
    int anonymizeCustomer(UUID salonId, String email, String replacement);
}

interface OrderLineActivityRepository extends ListCrudRepository<OrderLineActivity, Long> {
    List<OrderLineActivity> findByOrderLineIdInOrderByCreatedAtAsc(Collection<Long> orderLineIds);
}

interface ShopOrderActivityRepository extends ListCrudRepository<ShopOrderActivity, Long> {
    List<ShopOrderActivity> findByOrderIdOrderByCreatedAtAsc(Long orderId);

    /** The subject/body are the email as the customer received it — their name and address are in it. */
    @Modifying
    @Query("""
            UPDATE shop_order_activity SET subject = NULL, body = NULL
            WHERE salon_id = :salonId AND (subject IS NOT NULL OR body IS NOT NULL)
              AND order_id IN (SELECT id FROM shop_order WHERE salon_id = :salonId AND customer_email = :replacement)""")
    int redactNotifiedEmails(UUID salonId, String replacement);
}

interface ShippingMethodRepository extends ListCrudRepository<ShippingMethod, Long> {
    List<ShippingMethod> findBySalonIdOrderBySortOrderAscNameAsc(UUID salonId);
    Optional<ShippingMethod> findByIdAndSalonId(Long id, UUID salonId);
}
