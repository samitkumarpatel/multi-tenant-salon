package net.samitkumar.multi_tenant_salon.shop.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.payments.PaymentGateway;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.shop.Brand;
import net.samitkumar.multi_tenant_salon.shop.Category;
import net.samitkumar.multi_tenant_salon.shop.CommunicationPreference;
import net.samitkumar.multi_tenant_salon.shop.OrderLineActivity;
import net.samitkumar.multi_tenant_salon.shop.OrderLineActivityAddedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderLineActivityType;
import net.samitkumar.multi_tenant_salon.shop.OrderPlacedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderStatus;
import net.samitkumar.multi_tenant_salon.shop.OrderStatusChangedEvent;
import net.samitkumar.multi_tenant_salon.shop.PaymentStatus;
import net.samitkumar.multi_tenant_salon.shop.Product;
import net.samitkumar.multi_tenant_salon.shop.ProductVariant;
import net.samitkumar.multi_tenant_salon.shop.ShopOrder;
import net.samitkumar.multi_tenant_salon.shop.ShopOrderActivity;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopViews.InventoryRow;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopViews.OrderLineView;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopViews.OrderPage;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopViews.OrderView;
import net.samitkumar.multi_tenant_salon.shop.internal.ShopViews.ProductView;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
class ShopManager {

    private static final String DEFAULT_CURRENCY = "USD";
    /** Same shape the storefront checks client-side: something@domain.tld, no spaces. */
    private static final java.util.regex.Pattern EMAIL = java.util.regex.Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final BrandRepository brandRepo;
    private final CategoryRepository categoryRepo;
    private final ProductRepository productRepo;
    private final ProductVariantRepository variantRepo;
    private final ShopOrderRepository orderRepo;
    private final OrderLineActivityRepository activityRepo;
    private final ShopOrderActivityRepository orderActivityRepo;
    private final SalonApi salonApi;
    private final ApplicationEventPublisher eventPublisher;
    private final JdbcClient jdbcClient;
    // Module tests may run the shop without the payments module; then refunds stay bookkeeping-only.
    private final ObjectProvider<PaymentGateway> payments;
    private final ShippingMethodService shipping;
    private final ShopCurrency shopCurrency;

    ShopManager(BrandRepository brandRepo, CategoryRepository categoryRepo, ProductRepository productRepo,
                ProductVariantRepository variantRepo, ShopOrderRepository orderRepo,
                OrderLineActivityRepository activityRepo, ShopOrderActivityRepository orderActivityRepo,
                SalonApi salonApi, ApplicationEventPublisher eventPublisher, JdbcTemplate jdbcTemplate,
                ObjectProvider<PaymentGateway> payments, ShippingMethodService shipping, ShopCurrency shopCurrency) {
        this.brandRepo = brandRepo;
        this.categoryRepo = categoryRepo;
        this.productRepo = productRepo;
        this.variantRepo = variantRepo;
        this.orderRepo = orderRepo;
        this.activityRepo = activityRepo;
        this.orderActivityRepo = orderActivityRepo;
        this.salonApi = salonApi;
        this.eventPublisher = eventPublisher;
        this.jdbcClient = JdbcClient.create(jdbcTemplate);
        this.payments = payments;
        this.shipping = shipping;
        this.shopCurrency = shopCurrency;
    }

    public record VariantSpec(Long id, String sku, String label, BigDecimal price, BigDecimal compareAtPrice,
                              String currency, Integer quantityOnHand, Integer reorderLevel, Boolean active,
                              Integer weightGrams) {}

    public record CheckoutItem(Long variantId, int quantity) {}

    public record CheckoutRequest(String customerName, String customerEmail, String customerPhone,
                                  ShopOrder.ShippingAddress shippingAddress, List<CheckoutItem> items,
                                  CommunicationPreference communicationPreference, Long shippingMethodId) {}

    /** What the variant currencies are aligned to, and how many variants changed. */
    record CurrencyAlignment(String currency, int updated) {}

    // ── Brands ───────────────────────────────────────────────────────────────

    List<Brand> listBrands(UUID salonId) {
        return brandRepo.findBySalonIdOrderByNameAsc(salonId);
    }

    Brand addBrand(UUID salonId, String name, String description, String logoUrl) {
        requireText(name, "Brand name is required");
        return brandRepo.save(new Brand(null, salonId, name.trim(), description, logoUrl, true, Instant.now()));
    }

    Optional<Brand> updateBrand(UUID salonId, Long brandId, String name, String description, String logoUrl, boolean active) {
        requireText(name, "Brand name is required");
        return brandRepo.findByIdAndSalonId(brandId, salonId)
                .map(b -> brandRepo.save(new Brand(b.id(), salonId, name.trim(), description, logoUrl, active, b.createdAt())));
    }

    void deleteBrand(UUID salonId, Long brandId) {
        brandRepo.findByIdAndSalonId(brandId, salonId).ifPresent(b -> brandRepo.deleteById(brandId));
    }

    // ── Categories ───────────────────────────────────────────────────────────

    List<Category> listCategories(UUID salonId) {
        return categoryRepo.findBySalonIdOrderByNameAsc(salonId);
    }

    Category addCategory(UUID salonId, String name, String description) {
        requireText(name, "Category name is required");
        return categoryRepo.save(new Category(null, salonId, name.trim(), description, true, Instant.now()));
    }

    Optional<Category> updateCategory(UUID salonId, Long categoryId, String name, String description, boolean active) {
        requireText(name, "Category name is required");
        return categoryRepo.findByIdAndSalonId(categoryId, salonId)
                .map(c -> categoryRepo.save(new Category(c.id(), salonId, name.trim(), description, active, c.createdAt())));
    }

    void deleteCategory(UUID salonId, Long categoryId) {
        categoryRepo.findByIdAndSalonId(categoryId, salonId).ifPresent(c -> categoryRepo.deleteById(categoryId));
    }

    // ── Products + variants ──────────────────────────────────────────────────

    List<ProductView> listProducts(UUID salonId, boolean activeOnly) {
        return listProducts(salonId, activeOnly, null, null);
    }

    List<ProductView> listProducts(UUID salonId, boolean activeOnly, Long brandId, Long categoryId) {
        var products = activeOnly
                ? productRepo.findBySalonIdAndActiveOrderByCreatedAtDesc(salonId, true)
                : productRepo.findBySalonIdOrderByCreatedAtDesc(salonId);
        var variantsByProduct = variantRepo.findBySalonId(salonId).stream()
                .collect(Collectors.groupingBy(ProductVariant::productId));
        var brandNames = brandRepo.findBySalonIdOrderByNameAsc(salonId).stream()
                .collect(Collectors.toMap(Brand::id, Brand::name));
        var categoryNames = categoryRepo.findBySalonIdOrderByNameAsc(salonId).stream()
                .collect(Collectors.toMap(Category::id, Category::name));

        return products.stream()
                .map(p -> {
                    var vs = variantsByProduct.getOrDefault(p.id(), List.of());
                    var visible = activeOnly ? vs.stream().filter(ProductVariant::active).toList() : vs;
                    return new ProductView(p.id(), p.salonId(),
                            p.brandId(), p.brandId() == null ? null : brandNames.get(p.brandId()),
                            p.categoryId(), p.categoryId() == null ? null : categoryNames.get(p.categoryId()),
                            p.name(), p.handle(), p.description(), p.imageUrl(), imagesOf(p), p.active(), p.createdAt(), visible);
                })
                .filter(pv -> !activeOnly || !pv.variants().isEmpty())
                .filter(pv -> brandId == null || Objects.equals(pv.brandId(), brandId))
                .filter(pv -> categoryId == null || Objects.equals(pv.categoryId(), categoryId))
                .toList();
    }

    /** Lookup includes old handles; callers redirect to the returned canonical handle. */
    Optional<ProductView> getProductByHandle(UUID salonId, String handle) {
        var salon = salonApi.findById(salonId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (salon.status() == net.samitkumar.multi_tenant_salon.salon.Salon.SalonStatus.DISABLED
                || salon.features().stream().noneMatch(f -> f.feature() == net.samitkumar.multi_tenant_salon.salon.SalonFeature.WEBSHOP)) return Optional.empty();
        return jdbcClient.sql("SELECT product_id FROM product_handle WHERE salon_id=:salon AND handle=:handle AND product_id IS NOT NULL")
                .param("salon", salonId).param("handle", handle).query(Long.class).optional()
                // A product's own handle is authoritative if its reservation row is missing.
                .or(() -> jdbcClient.sql("SELECT id FROM product WHERE salon_id=:salon AND handle=:handle")
                        .param("salon", salonId).param("handle", handle).query(Long.class).optional())
                .flatMap(id -> getProduct(salonId, id, true)).filter(p -> !p.variants().isEmpty());
    }

    private void lockHandleNamespace(UUID salonId) {
        jdbcClient.sql("SELECT id FROM salon WHERE id=:salon FOR UPDATE").param("salon", salonId).query(UUID.class)
                .optional().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private String assignHandle(UUID salonId, Long productId, String name, String requested) {
        // Serialize allocation per tenant; a preflight existence check alone races on duplicate names.
        lockHandleNamespace(salonId);
        boolean automatic = requested == null || requested.isBlank();
        String base = automatic ? productHandle(name) : requested.trim();
        if (!base.matches("[a-z0-9]+(?:-[a-z0-9]+)*") || base.length() > 100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use up to 100 lowercase letters, numbers and single hyphens for the product handle.");
        String candidate = base;
        int suffix = 1;
        while (handleReserved(salonId, candidate, productId)) {
            if (!automatic) throw new ResponseStatusException(HttpStatus.CONFLICT, "This product handle is already reserved. Choose another handle.");
            candidate = base + "-" + (++suffix);
        }
        return candidate;
    }

    private boolean handleReserved(UUID salonId, String handle, Long productId) {
        return jdbcClient.sql("""
                SELECT EXISTS(SELECT 1 FROM product_handle WHERE salon_id=:salon AND handle=:handle
                              AND (product_id IS NULL OR product_id<>:product))
                    OR EXISTS(SELECT 1 FROM product WHERE salon_id=:salon AND handle=:handle AND id<>:product)
                """).param("salon", salonId).param("handle", handle).param("product", productId == null ? -1L : productId)
                .query(Boolean.class).single();
    }

    private void reserveHandle(Product product) {
        jdbcClient.sql("INSERT INTO product_handle(salon_id,handle,product_id) VALUES (:salon,:handle,:product) ON CONFLICT DO NOTHING")
                .param("salon", product.salonId()).param("handle", product.handle()).param("product", product.id()).update();
    }

    static String productHandle(String name) {
        var normalized = java.text.Normalizer.normalize(name.toLowerCase(Locale.ROOT)
                .replace("æ", "ae").replace("œ", "oe").replace("ø", "o").replace("ß", "ss"), java.text.Normalizer.Form.NFKD)
                .replaceAll("\\p{M}+", "").replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        normalized = normalized.substring(0, Math.min(80, normalized.length())).replaceAll("-$", "");
        return normalized.isEmpty() ? "product" : normalized;
    }

    List<Brand> listPublicBrands(UUID salonId) {
        return brandRepo.findBySalonIdOrderByNameAsc(salonId).stream().filter(Brand::active).toList();
    }

    List<Category> listPublicCategories(UUID salonId) {
        return categoryRepo.findBySalonIdOrderByNameAsc(salonId).stream().filter(Category::active).toList();
    }

    Optional<ProductView> getProduct(UUID salonId, Long productId, boolean activeOnly) {
        return productRepo.findByIdAndSalonId(productId, salonId)
                .filter(p -> !activeOnly || p.active())
                .map(p -> {
                    var vs = variantRepo.findByProductId(p.id());
                    var visible = activeOnly ? vs.stream().filter(ProductVariant::active).toList() : vs;
                    return toProductView(p, visible);
                });
    }

    @Transactional
    ProductView addProduct(UUID salonId, Long brandId, Long categoryId, String name, String description,
                           String imageUrl, List<String> images, List<VariantSpec> variants, String requestedHandle) {
        requireText(name, "Product name is required");
        validateBrandCategory(salonId, brandId, categoryId);
        // Validate the options before anything is written.
        newVariants(null, salonId, variants == null ? List.of() : variants, false);
        var gallery = resolveImages(imageUrl, images);
        var cover = gallery.isEmpty() ? null : gallery.get(0);
        var handle = assignHandle(salonId, null, name, requestedHandle);
        var product = productRepo.save(new Product(null, salonId, brandId, categoryId, name.trim(), handle,
                description, cover, true, Instant.now(),
                gallery.stream().map(Product.ProductImage::new).toList()));
        reserveHandle(product);
        var saved = newVariants(product.id(), salonId, variants == null ? List.of() : variants, true).stream()
                .map(variantRepo::save)
                .toList();
        log.info("[ShopManager] Product added id={} salon={} variants={} images={}", product.id(), salonId, saved.size(), gallery.size());
        return toProductView(product, saved);
    }

    @Transactional
    Optional<ProductView> updateProduct(UUID salonId, Long productId, Long brandId, Long categoryId,
                                        String name, String description, String imageUrl, List<String> images,
                                        boolean active, List<VariantSpec> variants, String requestedHandle) {
        requireText(name, "Product name is required");
        validateBrandCategory(salonId, brandId, categoryId);
        lockHandleNamespace(salonId);
        var specs = variants == null ? List.<VariantSpec>of() : variants;
        var built = newVariants(productId, salonId, specs, true);
        return productRepo.findByIdAndSalonId(productId, salonId).map(existing -> {
            var gallery = resolveImages(imageUrl, images);
            var cover = gallery.isEmpty() ? null : gallery.get(0);
            var handle = requestedHandle == null || requestedHandle.isBlank() ? existing.handle() : assignHandle(salonId, productId, name, requestedHandle);
            var updated = productRepo.save(new Product(existing.id(), salonId, brandId, categoryId, name.trim(), handle,
                    description, cover, active, existing.createdAt(),
                    gallery.stream().map(Product.ProductImage::new).toList()));

            reserveHandle(updated);
            var keepIds = specs.stream().map(VariantSpec::id).filter(Objects::nonNull).collect(Collectors.toSet());
            variantRepo.findByProductId(productId).stream()
                    .filter(v -> !keepIds.contains(v.id()))
                    .forEach(v -> variantRepo.deleteById(v.id()));

            var result = built.stream().map(variantRepo::save).toList();
            log.info("[ShopManager] Product updated id={} salon={} active={} variants={}", productId, salonId, active, result.size());
            return toProductView(updated, result);
        });
    }

    @Transactional
    void deleteProduct(UUID salonId, Long productId) {
        productRepo.findByIdAndSalonId(productId, salonId).ifPresent(p -> {
            variantRepo.deleteByProductId(productId);
            productRepo.deleteById(productId);
            log.info("[ShopManager] Product deleted id={} salon={}", productId, salonId);
        });
    }

    // ── Inventory ────────────────────────────────────────────────────────────

    List<InventoryRow> listInventory(UUID salonId) {
        var products = productRepo.findBySalonIdOrderByCreatedAtDesc(salonId).stream()
                .collect(Collectors.toMap(Product::id, p -> p));
        return variantRepo.findBySalonId(salonId).stream()
                .map(v -> {
                    var p = products.get(v.productId());
                    return new InventoryRow(v.id(), v.productId(),
                            p != null ? p.name() : "(unknown product)", p != null && p.active(),
                            v.sku(), v.label(), v.price(), v.currency(),
                            v.quantityOnHand(), v.reorderLevel(), v.active());
                })
                .sorted(Comparator.comparing(InventoryRow::productName, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(r -> r.label() == null ? "" : r.label(), String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    Optional<InventoryRow> updateInventory(UUID salonId, Long variantId, int quantityOnHand, int reorderLevel) {
        return variantRepo.findByIdAndSalonId(variantId, salonId).map(v -> {
            var saved = variantRepo.save(new ProductVariant(v.id(), v.productId(), v.salonId(), v.sku(), v.label(),
                    v.price(), v.compareAtPrice(), v.currency(), Math.max(0, quantityOnHand), Math.max(0, reorderLevel), v.active(),
                    v.weightGrams()));
            var p = productRepo.findById(saved.productId()).orElse(null);
            return new InventoryRow(saved.id(), saved.productId(),
                    p != null ? p.name() : "(unknown product)", p != null && p.active(),
                    saved.sku(), saved.label(), saved.price(), saved.currency(),
                    saved.quantityOnHand(), saved.reorderLevel(), saved.active());
        });
    }

    // ── Orders ───────────────────────────────────────────────────────────────

    OrderPage listOrders(UUID salonId, String q, OrderStatus status,
                         LocalDate from, LocalDate to, String sort, int page, int size) {
        int pageIdx = Math.max(0, page);
        int pageSize = Math.min(Math.max(size, 1), 100);

        var where = new StringBuilder("o.salon_id = :salon");
        var params = new HashMap<String, Object>();
        params.put("salon", salonId);

        if (from != null) {
            where.append(" AND o.created_at >= :from");
            params.put("from", from.atStartOfDay().atOffset(ZoneOffset.UTC));
        }
        if (to != null) {
            where.append(" AND o.created_at < :to");
            params.put("to", to.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC));
        }
        var term = q == null ? "" : q.strip();
        if (!term.isEmpty()) {
            where.append(" AND (o.order_number ILIKE :q OR o.customer_name ILIKE :q")
                 .append(" OR o.customer_email ILIKE :q OR o.customer_phone ILIKE :q")
                 .append(" OR o.payment_reference ILIKE :q OR o.tracking_number ILIKE :q")
                 .append(" OR EXISTS (SELECT 1 FROM shop_order_line l")
                 .append(" WHERE l.order_id = o.id AND l.product_name ILIKE :q))");
            var escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
            params.put("q", "%" + escaped + "%");
        }

        var facet = new EnumMap<OrderStatus, Long>(OrderStatus.class);
        for (OrderStatus s : OrderStatus.values()) facet.put(s, 0L);
        jdbcClient.sql("SELECT o.status AS status, COUNT(*) AS c FROM shop_order o WHERE " + where
                        + " GROUP BY o.status")
                .params(params)
                .query((rs, rowNum) -> Map.entry(OrderStatus.valueOf(rs.getString("status")), rs.getLong("c")))
                .list()
                .forEach(e -> facet.put(e.getKey(), e.getValue()));

        if (status != null) {
            where.append(" AND o.status = :status");
            params.put("status", status.name());
        }

        long total = jdbcClient.sql("SELECT COUNT(*) FROM shop_order o WHERE " + where)
                .params(params)
                .query(Long.class)
                .single();

        var orderBy = "oldest".equalsIgnoreCase(sort)
                ? "o.created_at ASC, o.id ASC"
                : "o.created_at DESC, o.id DESC";
        var ids = jdbcClient.sql("SELECT o.id FROM shop_order o WHERE " + where
                        + " ORDER BY " + orderBy + " LIMIT :limit OFFSET :offset")
                .params(params)
                .param("limit", pageSize)
                .param("offset", (long) pageIdx * pageSize)
                .query(Long.class)
                .list();

        Map<Long, ShopOrder> byId = ids.isEmpty()
                ? Map.of()
                : orderRepo.findAllById(ids).stream().collect(Collectors.toMap(ShopOrder::id, o -> o));
        var content = ids.stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .map(o -> toOrderView(o, Map.of(), List.of()))
                .toList();

        int totalPages = (int) Math.ceil(total / (double) pageSize);
        return new OrderPage(content, pageIdx, pageSize, total, totalPages, facet);
    }

    Optional<OrderView> getOrder(UUID salonId, Long orderId) {
        return orderRepo.findByIdAndSalonId(orderId, salonId).map(o -> {
            var lineIds = o.lines().stream().map(ShopOrder.OrderLine::id).toList();
            var byLine = lineIds.isEmpty()
                    ? Map.<Long, List<OrderLineActivity>>of()
                    : activityRepo.findByOrderLineIdInOrderByCreatedAtAsc(lineIds).stream()
                        .collect(Collectors.groupingBy(OrderLineActivity::orderLineId));
            var orderActivities = orderActivityRepo.findByOrderIdOrderByCreatedAtAsc(orderId);
            return toOrderView(o, byLine, orderActivities);
        });
    }

    @Transactional
    OrderView placeOrder(UUID salonId, CheckoutRequest req) {
        return placeOrder(salonId, req, false);
    }

    @Transactional
    OrderView placeOrder(UUID salonId, CheckoutRequest req, boolean stripePending) {
        if (req == null || req.items() == null || req.items().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Your cart is empty");
        }
        if (isBlank(req.customerName()) || isBlank(req.customerEmail())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name and email are required");
        }
        if (!EMAIL.matcher(req.customerEmail().trim()).matches()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email address");
        }

        var lines = new ArrayList<ShopOrder.OrderLine>();
        BigDecimal subtotal = BigDecimal.ZERO;
        String currency = null;
        int weightGrams = 0;

        for (var item : req.items()) {
            if (item.variantId() == null || item.quantity() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid cart item");
            }
            var variant = variantRepo.findByIdAndSalonId(item.variantId(), salonId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product option not found"));
            var product = productRepo.findByIdAndSalonId(variant.productId(), salonId)
                    .filter(Product::active)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "This product is no longer available"));
            // One order is one charge in one currency — before any stock is taken.
            if (currency != null && !currency.equalsIgnoreCase(variant.currency())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Items priced in different currencies can't be bought in one order");
            }

            int changed = jdbcClient.sql("""
                            UPDATE product_variant SET quantity_on_hand = quantity_on_hand - :qty
                            WHERE id = :id AND salon_id = :salon AND active = true AND quantity_on_hand >= :qty
                            """)
                    .param("qty", item.quantity())
                    .param("id", variant.id())
                    .param("salon", salonId)
                    .update();
            if (changed != 1) {
                var label = variant.label() != null && !variant.label().isBlank() ? " – " + variant.label() : "";
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "'" + product.name() + label + "' is out of stock");
            }

            var unitPrice = variant.price() != null ? variant.price() : BigDecimal.ZERO;
            var lineTotal = unitPrice.multiply(BigDecimal.valueOf(item.quantity()));
            subtotal = subtotal.add(lineTotal);
            if (currency == null) currency = variant.currency();
            if (variant.weightGrams() != null) weightGrams += variant.weightGrams() * item.quantity();
            lines.add(new ShopOrder.OrderLine(null, product.id(), variant.id(), product.name(), variant.label(),
                    unitPrice, item.quantity(), lineTotal));
        }

        int itemCount = lines.stream().mapToInt(ShopOrder.OrderLine::quantity).sum();
        var ship = shipping.select(salonId, req.shippingMethodId(), req.shippingAddress(),
                new ShippingMethodService.Cart(currency, subtotal, itemCount, weightGrams));

        var now = Instant.now();
        var finalCurrency = currency != null ? currency : DEFAULT_CURRENCY;
        var pref = req.communicationPreference() != null ? req.communicationPreference() : CommunicationPreference.IMPORTANT_ONLY;
        var order = new ShopOrder(null, salonId, generateOrderNumber(),
                req.customerName().trim(), req.customerEmail().trim(), trimToNull(req.customerPhone()),
                req.shippingAddress(), OrderStatus.NEW, stripePending ? PaymentStatus.PENDING : PaymentStatus.PAID,
                stripePending ? null : "DUMMY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT),
                subtotal, finalCurrency, now, null, null, pref,
                null, null, null,
                null, null, null, null,
                null, null, null,
                ship.methodId(), ship.name(), ship.cost(), weightGrams,
                lines);
        var saved = orderRepo.save(order);

        for (var line : saved.lines()) {
            var label = line.variantLabel() != null && !line.variantLabel().isBlank() ? " (" + line.variantLabel() + ")" : "";
            activityRepo.save(new OrderLineActivity(null, line.id(), salonId, OrderLineActivityType.LINE_CREATED,
                    line.quantity() + " × " + line.productName() + label + " ordered", "customer", now));
        }

        if (!stripePending) publishOrderPlaced(saved);

        if (!stripePending) recordOrderActivity(saved.id(), salonId, "ORDER_PLACED",
                "Order " + saved.orderNumber() + " placed by " + saved.customerName(),
                "customer", false, saved.customerEmail(), saved.customerPhone());
        log.info("[ShopManager] Order placed id={} number={} salon={} lines={} subtotal={} {}",
                saved.id(), saved.orderNumber(), salonId, saved.lines().size(), saved.subtotal(), saved.currency());
        return getOrder(salonId, saved.id()).orElseThrow();
    }

    /**
     * Prices and weighs a cart the way {@link #placeOrder} will — unknown or inactive variants simply
     * don't count. The currency is the first item's, as in {@code placeOrder}.
     */
    ShippingMethodService.Cart cart(UUID salonId, List<CheckoutItem> items) {
        var subtotal = BigDecimal.ZERO;
        int count = 0;
        int weight = 0;
        String currency = null;
        for (var item : items == null ? List.<CheckoutItem>of() : items) {
            if (item == null || item.variantId() == null || item.quantity() <= 0) continue;
            var variant = variantRepo.findByIdAndSalonId(item.variantId(), salonId).filter(ProductVariant::active).orElse(null);
            if (variant == null) continue;
            var price = variant.price() != null ? variant.price() : BigDecimal.ZERO;
            subtotal = subtotal.add(price.multiply(BigDecimal.valueOf(item.quantity())));
            count += item.quantity();
            if (variant.weightGrams() != null) weight += variant.weightGrams() * item.quantity();
            if (currency == null) currency = variant.currency();
        }
        return new ShippingMethodService.Cart(currency, subtotal, count, weight);
    }

    /**
     * Re-labels every variant priced in another currency with the salon's currency, keeping the
     * amounts — for catalogues created while the editor defaulted to USD. Owner-triggered only.
     */
    @Transactional
    CurrencyAlignment alignCurrency(UUID salonId) {
        var currency = shopCurrency.of(salonId);
        int updated = jdbcClient.sql("UPDATE product_variant SET currency = :currency WHERE salon_id = :salon AND currency <> :currency")
                .param("currency", currency).param("salon", salonId).update();
        log.info("[ShopManager] Aligned variant currency salon={} currency={} updated={}", salonId, currency, updated);
        return new CurrencyAlignment(currency, updated);
    }

    @Transactional
    void recordStripePayment(UUID salonId, Long orderId, String sessionId, boolean succeeded) {
        var order = orderRepo.findByIdAndSalonId(orderId, salonId).orElse(null);
        if (order == null || order.paymentStatus() != PaymentStatus.PENDING) return;
        int changed = jdbcClient.sql("UPDATE shop_order SET payment_status = :status, payment_reference = :reference WHERE id = :id AND salon_id = :salon AND payment_status = 'PENDING'")
                .param("status", succeeded ? PaymentStatus.PAID.name() : PaymentStatus.FAILED.name())
                .param("reference", sessionId).param("id", orderId).param("salon", salonId).update();
        if (changed != 1) return;
        if (!succeeded) {
            restockOrderLines(salonId, order);
            recordOrderActivity(order.id(), salonId, "PAYMENT_FAILED", "Payment failed or checkout expired", "system", false, null, null);
        } else {
            publishOrderPlaced(new ShopOrder(order.id(), order.salonId(), order.orderNumber(), order.customerName(),
                    order.customerEmail(), order.customerPhone(), order.shippingAddress(), order.status(), PaymentStatus.PAID,
                    sessionId, order.subtotal(), order.currency(), order.createdAt(), order.trackingCarrier(), order.trackingNumber(),
                    order.communicationPreference(), order.refundAmount(), order.refundReason(), order.refundStatus(),
                    order.returnStatus(), order.returnReason(), order.returnNotes(), order.returnUpdatedAt(), order.creditNoteRef(),
                    order.creditNoteStatus(), order.creditNoteAt(), order.shippingMethodId(), order.shippingMethodName(),
                    order.shippingCost(), order.totalWeightGrams(), order.lines()));
            recordOrderActivity(order.id(), salonId, "ORDER_PLACED",
                    "Order " + order.orderNumber() + " placed by " + order.customerName(),
                    "customer", false, order.customerEmail(), order.customerPhone());
            recordOrderActivity(order.id(), salonId, "PAYMENT_PAID", "Payment received", "system", false, null, null);
        }
    }

    /**
     * Puts an order's items back on the shelf, at most once per order. A cancellation, a received
     * return and a failed payment can all reach this for the same order; claiming
     * {@code stock_restored_at} with a conditional UPDATE is what keeps the credit single, the same
     * way the checkout decrement guards itself with {@code quantity_on_hand >= :qty}.
     *
     * @return whether this call was the one that restocked
     */
    private boolean restockOrderLines(UUID salonId, ShopOrder order) {
        int claimed = jdbcClient.sql("""
                        UPDATE shop_order SET stock_restored_at = :at
                        WHERE id = :id AND salon_id = :salon AND stock_restored_at IS NULL
                        """)
                // OffsetDateTime, not Instant — see the note in acceptRefund.
                .param("at", OffsetDateTime.now(ZoneOffset.UTC))
                .param("id", order.id())
                .param("salon", salonId)
                .update();
        if (claimed != 1) return false;
        order.lines().stream().filter(line -> line.variantId() != null).forEach(line ->
                jdbcClient.sql("UPDATE product_variant SET quantity_on_hand = quantity_on_hand + :qty WHERE id = :id AND salon_id = :salon")
                        .param("qty", line.quantity()).param("id", line.variantId()).param("salon", salonId).update());
        log.info("[ShopManager] Restocked order id={} salon={} lines={}", order.id(), salonId, order.lines().size());
        return true;
    }

    private void publishOrderPlaced(ShopOrder order) {
        var contact = salonContact(order.salonId());
        eventPublisher.publishEvent(new OrderPlacedEvent(order.id(), order.salonId(), order.orderNumber(),
                order.customerName(), order.customerEmail(), order.customerPhone(),
                order.lines().stream().mapToInt(ShopOrder.OrderLine::quantity).sum(), order.subtotal(), order.currency(),
                contact.name(), contact.phone(), contact.email(), order.communicationPreference(),
                order.shippingMethodName(), order.shippingCost()));
    }

    @Transactional
    Optional<OrderView> updateOrderStatus(UUID salonId, Long orderId, OrderStatus newStatus, String actor) {
        var order = orderRepo.findByIdAndSalonId(orderId, salonId).orElse(null);
        if (order == null) return Optional.empty();
        if (order.status() == newStatus) return getOrder(salonId, orderId);

        if (order.status().isTerminal()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This order is " + prettyStatus(order.status()).toLowerCase(Locale.ROOT)
                            + " and can no longer change status.");
        }
        if (newStatus == OrderStatus.CANCELLED && order.status().isDispatched()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot cancel a " + order.status().name().toLowerCase() + " order. Start a return instead.");
        }

        jdbcClient.sql("UPDATE shop_order SET status = :s WHERE id = :id AND salon_id = :salon")
                .param("s", newStatus.name())
                .param("id", orderId)
                .param("salon", salonId)
                .update();

        // Cancelling frees the goods again — without this the quantity the checkout took stays
        // gone and the owner has to notice and re-enter it by hand on the Inventory tab.
        if (newStatus == OrderStatus.CANCELLED) restockOrderLines(salonId, order);

        var now = Instant.now();
        var message = "Order moved to " + prettyStatus(newStatus);
        for (var line : order.lines()) {
            activityRepo.save(new OrderLineActivity(null, line.id(), salonId, OrderLineActivityType.STATUS_CHANGED,
                    message, actor, now));
        }

        recordOrderActivity(orderId, salonId, "STATUS_CHANGED",
                "Order status changed to " + prettyStatus(newStatus),
                actor, true, order.customerEmail(), order.customerPhone());
        var contact = salonContact(salonId);
        eventPublisher.publishEvent(new OrderStatusChangedEvent(orderId, salonId, order.orderNumber(), newStatus,
                order.customerName(), order.customerEmail(), contact.name(), contact.phone(), contact.email(),
                order.communicationPreference()));
        log.info("[ShopManager] Order id={} salon={} status → {}", orderId, salonId, newStatus);
        return getOrder(salonId, orderId);
    }

    @Transactional
    Optional<OrderView> notifyUserForLine(UUID salonId, Long orderId, Long lineId, String customMessage, String actor) {
        return addLineActivity(salonId, orderId, lineId, OrderLineActivityType.USER_NOTIFIED,
                line -> customMessage != null ? customMessage : "Customer notified about " + line.productName(), actor, true);
    }

    @Transactional
    Optional<OrderView> addNoteToLine(UUID salonId, Long orderId, Long lineId, String note, String actor) {
        requireText(note, "Note text is required");
        return addLineActivity(salonId, orderId, lineId, OrderLineActivityType.NOTE_ADDED,
                line -> note.trim(), actor, false);
    }

    private Optional<OrderView> addLineActivity(UUID salonId, Long orderId, Long lineId, OrderLineActivityType type,
                                                java.util.function.Function<ShopOrder.OrderLine, String> message,
                                                String actor, boolean emitEvent) {
        var order = orderRepo.findByIdAndSalonId(orderId, salonId).orElse(null);
        if (order == null) return Optional.empty();
        var line = order.lines().stream().filter(l -> l.id().equals(lineId)).findFirst().orElse(null);
        if (line == null) return Optional.empty();

        var text = message.apply(line);
        activityRepo.save(new OrderLineActivity(null, lineId, salonId, type, text, actor, Instant.now()));

        if (emitEvent) {
            var contact = salonContact(salonId);
            eventPublisher.publishEvent(new OrderLineActivityAddedEvent(orderId, salonId, order.orderNumber(), lineId,
                    line.productName(), type, text, order.customerName(), order.customerEmail(),
                    contact.name(), contact.email()));
        }
        return getOrder(salonId, orderId);
    }

    // ── Order-level activities ─────────────────────────────────────────────────

    private static boolean isImportantActivity(String type) {
        return switch (type) {
            case "SHIPMENT_CREATED", "INVOICE_SENT", "REFUND_ACCEPTED", "CREDIT_PAID" -> true;
            default -> false;
        };
    }

    private ShopOrderActivity recordOrderActivity(Long orderId, UUID salonId, String type, String message,
                                                  String actor, boolean notify, String customerEmail, String customerPhone) {
        boolean shouldNotify = notify;
        if (shouldNotify) {
            var commPref = orderRepo.findById(orderId)
                    .map(ShopOrder::communicationPreference)
                    .orElse(CommunicationPreference.IMPORTANT_ONLY);
            if (commPref == CommunicationPreference.IMPORTANT_ONLY && !isImportantActivity(type)) {
                shouldNotify = false;
            }
        }
        var activity = orderActivityRepo.save(new ShopOrderActivity(null, orderId, salonId, type, message, actor, shouldNotify,
                null, null, null, null, Instant.now()));
        if (shouldNotify) {
            log.info("[NOTIFICATION] To: {} | Phone: {} | Type: {} | Message: {}",
                    customerEmail, customerPhone != null ? customerPhone : "—", type, message);
        }
        return activity;
    }

    @Transactional
    void recordCustomerNotification(UUID salonId, String orderNumber, String channel, String recipient,
                                    String subject, String body, String status, Instant sentAt) {
        var order = orderRepo.findByOrderNumberAndSalonId(orderNumber, salonId).orElse(null);
        if (order == null) {
            log.warn("[ShopManager] Notification ack for unknown order {} salon {} — dropped", orderNumber, salonId);
            return;
        }
        orderActivityRepo.save(new ShopOrderActivity(null, order.id(), salonId, "CUSTOMER_NOTIFIED",
                subject, "system", true, channel, subject, body, status,
                sentAt != null ? sentAt : Instant.now()));
        log.info("[ShopManager] Recorded customer notification for order {} ({}, {})", orderNumber, channel, status);
    }

    Optional<OrderView> sendInvoice(UUID salonId, Long orderId) {
        var order = orderRepo.findByIdAndSalonId(orderId, salonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        var invoiceNumber = "INV-" + order.orderNumber();
        recordOrderActivity(orderId, salonId, "INVOICE_SENT",
                "Invoice " + invoiceNumber + " issued and sent to " + order.customerEmail(),
                "admin", true, order.customerEmail(), order.customerPhone());
        log.info("[ShopManager] Invoice sent for orderId={}", orderId);
        return getOrder(salonId, orderId);
    }

    Optional<OrderView> addWorkNote(UUID salonId, Long orderId, String note) {
        orderRepo.findByIdAndSalonId(orderId, salonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        recordOrderActivity(orderId, salonId, "WORK_NOTE", note.trim(), "admin", false, null, null);
        return getOrder(salonId, orderId);
    }

    @Transactional
    Optional<OrderView> addShipping(UUID salonId, Long orderId, String carrier, String trackingNumber) {
        var order = orderRepo.findByIdAndSalonId(orderId, salonId).orElse(null);
        if (order == null) return Optional.empty();
        if (order.status().isTerminal()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This order is " + prettyStatus(order.status()).toLowerCase(Locale.ROOT)
                            + " — add shipping only to an open order.");
        }

        jdbcClient.sql("UPDATE shop_order SET tracking_carrier = :c, tracking_number = :t WHERE id = :id AND salon_id = :salon")
                .param("c", trimToNull(carrier))
                .param("t", trimToNull(trackingNumber))
                .param("id", orderId)
                .param("salon", salonId)
                .update();

        var msg = "Shipment dispatched"
                + (carrier != null && !carrier.isBlank() ? " via " + carrier.trim() : "")
                + (trackingNumber != null && !trackingNumber.isBlank() ? " — tracking: " + trackingNumber.trim() : "");
        recordOrderActivity(orderId, salonId, "SHIPMENT_CREATED", msg, "admin", true,
                order.customerEmail(), order.customerPhone());
        // Dispatching is a status change like any other, so it goes through updateOrderStatus and
        // publishes OrderStatusChangedEvent — writing 'SHIPPED' straight to the row here would
        // leave notifications and the timeline blind to the transition.
        if (!order.status().isDispatched()) {
            updateOrderStatus(salonId, orderId, OrderStatus.SHIPPED, "admin");
        }
        log.info("[ShopManager] Shipping set orderId={} carrier={} tracking={}", orderId, carrier, trackingNumber);
        return getOrder(salonId, orderId);
    }

    @Transactional
    Optional<OrderView> notifyCustomer(UUID salonId, Long orderId, String message) {
        var order = orderRepo.findByIdAndSalonId(orderId, salonId).orElse(null);
        if (order == null) return Optional.empty();
        requireText(message, "Message is required");
        recordOrderActivity(orderId, salonId, "CUSTOMER_NOTIFIED", message.trim(), "admin", true,
                order.customerEmail(), order.customerPhone());
        return getOrder(salonId, orderId);
    }

    // ── Refunds (inline on order) ─────────────────────────────────────────────

    List<OrderView> listRefunds(UUID salonId) {
        return orderRepo.findBySalonIdOrderByCreatedAtDesc(salonId).stream()
                .filter(o -> o.refundStatus() != null)
                .map(o -> toOrderView(o, Map.of(), List.of()))
                .toList();
    }

    @Transactional
    OrderView createRefund(UUID salonId, Long orderId, BigDecimal amount, String reason) {
        var order = orderRepo.findByIdAndSalonId(orderId, salonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (order.refundStatus() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A refund already exists for this order");
        }
        jdbcClient.sql("UPDATE shop_order SET refund_amount = :a, refund_reason = :r, refund_status = 'PENDING' WHERE id = :id AND salon_id = :salon")
                .param("a", amount)
                .param("r", trimToNull(reason))
                .param("id", orderId)
                .param("salon", salonId)
                .update();
        var msg = "Refund of " + amount + " " + order.currency() + (reason != null && !reason.isBlank() ? " — " + reason : "") + " initiated";
        recordOrderActivity(orderId, salonId, "REFUND_INITIATED", msg, "admin", true, order.customerEmail(), order.customerPhone());
        return getOrder(salonId, orderId).orElseThrow();
    }

    @Transactional
    OrderView approveRefund(UUID salonId, Long orderId) {
        var order = orderRepo.findByIdAndSalonId(orderId, salonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (!"PENDING".equals(order.refundStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only PENDING refunds can be approved");
        }
        jdbcClient.sql("UPDATE shop_order SET refund_status = 'APPROVED' WHERE id = :id AND salon_id = :salon")
                .param("id", orderId).param("salon", salonId).update();
        recordOrderActivity(orderId, salonId, "REFUND_APPROVED",
                "Refund of " + order.refundAmount() + " " + order.currency() + " approved — awaiting item return",
                "admin", false, null, null);
        return getOrder(salonId, orderId).orElseThrow();
    }

    @Transactional
    OrderView acceptRefund(UUID salonId, Long orderId) {
        var order = orderRepo.findByIdAndSalonId(orderId, salonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (!"APPROVED".equals(order.refundStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only APPROVED refunds can be accepted");
        }
        // Paid by card online: the money goes back to that card now (Stripe), not only on the credit note.
        var gateway = payments.getIfAvailable();
        var cardRefund = gateway == null ? Optional.<PaymentGateway.Refund>empty()
                : gateway.refundIfPaid(salonId, "SHOP", String.valueOf(orderId), order.refundAmount(), order.refundReason(), "admin");
        var ref = "CN-" + Long.toString(System.nanoTime() & Long.MAX_VALUE, 36).toUpperCase(Locale.ROOT);
        // OffsetDateTime, not Instant: pgjdbc can't infer a SQL type for java.time.Instant
        // on a raw JdbcClient param (Spring Data JDBC entity saves handle it via converters).
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        jdbcClient.sql("""
                UPDATE shop_order SET refund_status = 'ACCEPTED',
                    credit_note_ref = :ref, credit_note_status = 'PENDING', credit_note_at = :at
                WHERE id = :id AND salon_id = :salon
                """)
                .param("ref", ref)
                .param("at", now)
                .param("id", orderId)
                .param("salon", salonId)
                .update();
        recordOrderActivity(orderId, salonId, "REFUND_ACCEPTED",
                "Refund of " + order.refundAmount() + " " + order.currency() + " processed — credit note " + ref + " created"
                        + cardRefund.map(r -> "; refunded to the customer's card (" + r.status() + ")").orElse(""),
                "admin", true, order.customerEmail(), order.customerPhone());
        return getOrder(salonId, orderId).orElseThrow();
    }

    @Transactional
    OrderView rejectRefund(UUID salonId, Long orderId) {
        var order = orderRepo.findByIdAndSalonId(orderId, salonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (order.refundStatus() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No refund on this order");
        }
        jdbcClient.sql("UPDATE shop_order SET refund_status = 'REJECTED' WHERE id = :id AND salon_id = :salon")
                .param("id", orderId).param("salon", salonId).update();
        recordOrderActivity(orderId, salonId, "REFUND_REJECTED",
                "Refund of " + order.refundAmount() + " " + order.currency() + " rejected",
                "admin", true, order.customerEmail(), order.customerPhone());
        return getOrder(salonId, orderId).orElseThrow();
    }

    // ── Credit note (inline on order) ─────────────────────────────────────────

    @Transactional
    OrderView payCreditNote(UUID salonId, Long orderId) {
        var order = orderRepo.findByIdAndSalonId(orderId, salonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (!"PENDING".equals(order.creditNoteStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No pending credit note on this order");
        }
        jdbcClient.sql("UPDATE shop_order SET credit_note_status = 'PAID' WHERE id = :id AND salon_id = :salon")
                .param("id", orderId).param("salon", salonId).update();
        recordOrderActivity(orderId, salonId, "CREDIT_PAID",
                "Credit note " + order.creditNoteRef() + " paid back to customer",
                "admin", true, order.customerEmail(), order.customerPhone());
        return getOrder(salonId, orderId).orElseThrow();
    }

    // ── Credit note list ──────────────────────────────────────────────────────

    List<OrderView> listCreditNoteOrders(UUID salonId) {
        return orderRepo.findBySalonIdOrderByCreatedAtDesc(salonId).stream()
                .filter(o -> o.creditNoteRef() != null)
                .map(o -> toOrderView(o, Map.of(), List.of()))
                .toList();
    }

    // ── Returns (inline on order) ─────────────────────────────────────────────

    List<OrderView> listReturns(UUID salonId) {
        return orderRepo.findBySalonIdOrderByCreatedAtDesc(salonId).stream()
                .filter(o -> o.returnStatus() != null)
                .map(o -> toOrderView(o, Map.of(), List.of()))
                .toList();
    }

    @Transactional
    OrderView createReturn(UUID salonId, Long orderId, String reason) {
        var order = orderRepo.findByIdAndSalonId(orderId, salonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (order.returnStatus() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A return already exists for this order");
        }
        var now = OffsetDateTime.now(ZoneOffset.UTC);   // raw JdbcClient param — see acceptRefund note
        jdbcClient.sql("UPDATE shop_order SET return_status = 'REQUESTED', return_reason = :r, return_updated_at = :at WHERE id = :id AND salon_id = :salon")
                .param("r", trimToNull(reason))
                .param("at", now)
                .param("id", orderId)
                .param("salon", salonId)
                .update();
        recordOrderActivity(orderId, salonId, "RETURN_REQUESTED",
                "Return requested" + (reason != null && !reason.isBlank() ? " — " + reason : ""),
                "customer", true, order.customerEmail(), order.customerPhone());
        log.info("[ShopManager] Return created orderId={} salon={}", orderId, salonId);
        return getOrder(salonId, orderId).orElseThrow();
    }

    @Transactional
    OrderView updateReturnStatus(UUID salonId, Long orderId, String status, String notes) {
        var order = orderRepo.findByIdAndSalonId(orderId, salonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (order.returnStatus() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No return on this order");
        }
        var now = OffsetDateTime.now(ZoneOffset.UTC);   // raw JdbcClient param — see acceptRefund note
        jdbcClient.sql("UPDATE shop_order SET return_status = :s, return_notes = :n, return_updated_at = :at WHERE id = :id AND salon_id = :salon")
                .param("s", status)
                .param("n", trimToNull(notes))
                .param("at", now)
                .param("id", orderId)
                .param("salon", salonId)
                .update();
        // The goods are physically back at this point, so they go back on the shelf.
        if ("RECEIVED".equals(status) || "ACCEPTED".equals(status)) restockOrderLines(salonId, order);

        boolean notify = "APPROVED".equals(status) || "ACCEPTED".equals(status);
        recordOrderActivity(orderId, salonId, "RETURN_UPDATED",
                "Return → " + status.toLowerCase().replace('_', ' '),
                "admin", notify, order.customerEmail(), order.customerPhone());
        log.info("[ShopManager] Return status orderId={} → {}", orderId, status);
        return getOrder(salonId, orderId).orElseThrow();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Validates and builds a product's variants. A missing currency is the salon's; all variants of a
     * product must share one (a cart is charged in one currency). A missing weight is estimated from
     * the label ({@link VariantWeights}); a variant whose weight is neither given nor estimable is
     * refused, because weight-based shipping rules need it.
     */
    private List<ProductVariant> newVariants(Long productId, UUID salonId, List<VariantSpec> specs, boolean build) {
        String salonCurrency = null;
        String productCurrency = null;
        var out = new ArrayList<ProductVariant>();
        for (var v : specs) {
            String currency;
            if (v.currency() != null && !v.currency().isBlank()) {
                currency = v.currency().trim().toUpperCase(Locale.ROOT);
            } else {
                if (salonCurrency == null) salonCurrency = shopCurrency.of(salonId);
                currency = salonCurrency;
            }
            if (!currency.matches("[A-Z]{3}")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Currency must be a 3-letter ISO code");
            }
            if (productCurrency == null) productCurrency = currency;
            else if (!productCurrency.equals(currency)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All options of a product must use the same currency");
            }
            var label = trimToNull(v.label());
            var weight = v.weightGrams() != null ? v.weightGrams() : VariantWeights.estimateGrams(label);
            if (weight == null || weight <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Enter a shipping weight for '" + (label != null ? label : "the default option") + "'");
            }
            if (!build) continue;
            out.add(new ProductVariant(v.id(), productId, salonId,
                    trimToNull(v.sku()), label,
                    v.price() != null ? v.price() : BigDecimal.ZERO,
                    v.compareAtPrice(),
                    currency,
                    v.quantityOnHand() != null ? Math.max(0, v.quantityOnHand()) : 0,
                    v.reorderLevel() != null ? Math.max(0, v.reorderLevel()) : 0,
                    v.active() == null || v.active(),
                    weight));
        }
        return out;
    }

    private void validateBrandCategory(UUID salonId, Long brandId, Long categoryId) {
        if (brandId != null && brandRepo.findByIdAndSalonId(brandId, salonId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown brand");
        }
        if (categoryId != null && categoryRepo.findByIdAndSalonId(categoryId, salonId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown category");
        }
    }

    private ProductView toProductView(Product p, List<ProductVariant> variants) {
        String brandName = p.brandId() == null ? null
                : brandRepo.findById(p.brandId()).map(Brand::name).orElse(null);
        String categoryName = p.categoryId() == null ? null
                : categoryRepo.findById(p.categoryId()).map(Category::name).orElse(null);
        return new ProductView(p.id(), p.salonId(), p.brandId(), brandName, p.categoryId(), categoryName,
                p.name(), p.handle(), p.description(), p.imageUrl(), imagesOf(p), p.active(), p.createdAt(), variants);
    }

    private static List<String> imagesOf(Product p) {
        return p.images().stream().map(Product.ProductImage::value).toList();
    }

    private static List<String> resolveImages(String imageUrl, List<String> images) {
        var src = images != null ? images
                : imageUrl != null ? List.of(imageUrl)
                : List.<String>of();
        return src.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .limit(12)
                .toList();
    }

    private OrderView toOrderView(ShopOrder o, Map<Long, List<OrderLineActivity>> activitiesByLine,
                                  List<ShopOrderActivity> orderActivities) {
        var lines = o.lines().stream()
                .map(l -> new OrderLineView(l.id(), l.productId(), l.variantId(), l.productName(), l.variantLabel(),
                        l.unitPrice(), l.quantity(), l.lineTotal(),
                        activitiesByLine.getOrDefault(l.id(), List.of())))
                .toList();
        return new OrderView(o.id(), o.salonId(), o.orderNumber(), o.customerName(), o.customerEmail(), o.customerPhone(),
                o.shippingAddress(), o.status(), o.paymentStatus(), o.paymentReference(), o.subtotal(), o.currency(),
                o.createdAt(), o.trackingCarrier(), o.trackingNumber(), o.communicationPreference(),
                o.refundAmount(), o.refundReason(), o.refundStatus(),
                o.returnStatus(), o.returnReason(), o.returnNotes(), o.returnUpdatedAt(),
                o.creditNoteRef(), o.creditNoteStatus(), o.creditNoteAt(),
                o.shippingMethodId(), o.shippingMethodName(), o.shippingCost(), o.total(), o.totalWeightGrams(),
                lines, orderActivities);
    }

    private record SalonContact(String name, String phone, String email) {}

    private SalonContact salonContact(UUID salonId) {
        return salonApi.findById(salonId)
                .map(s -> new SalonContact(s.name(),
                        s.contact() != null ? s.contact().phone() : null,
                        s.contact() != null ? s.contact().email() : null))
                .orElse(new SalonContact(null, null, null));
    }

    private static String generateOrderNumber() {
        return "SO-" + Long.toString(System.nanoTime() & Long.MAX_VALUE, 36).toUpperCase(Locale.ROOT);
    }

    private static String prettyStatus(OrderStatus s) {
        return switch (s) {
            case NEW -> "new";
            case CONFIRMED -> "confirmed";
            case PROCESSING -> "processing";
            case READY_TO_SHIP -> "ready to ship";
            case SHIPPED -> "shipped";
            case DELIVERED -> "delivered";
            case FULFILLED -> "fulfilled";
            case CANCELLED -> "cancelled";
            case FAILED -> "failed";
            case ON_HOLD -> "on hold";
        };
    }

    private static void requireText(String value, String message) {
        if (isBlank(value)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        var t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
