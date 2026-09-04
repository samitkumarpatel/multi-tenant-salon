package net.samitkumar.multi_tenant_salon.shop.internal;

import lombok.extern.slf4j.Slf4j;
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

    ShopManager(BrandRepository brandRepo, CategoryRepository categoryRepo, ProductRepository productRepo,
                ProductVariantRepository variantRepo, ShopOrderRepository orderRepo,
                OrderLineActivityRepository activityRepo, ShopOrderActivityRepository orderActivityRepo,
                SalonApi salonApi, ApplicationEventPublisher eventPublisher, JdbcTemplate jdbcTemplate) {
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
    }

    public record VariantSpec(Long id, String sku, String label, BigDecimal price, BigDecimal compareAtPrice,
                              String currency, Integer quantityOnHand, Integer reorderLevel, Boolean active) {}

    public record CheckoutItem(Long variantId, int quantity) {}

    public record CheckoutRequest(String customerName, String customerEmail, String customerPhone,
                                  ShopOrder.ShippingAddress shippingAddress, List<CheckoutItem> items,
                                  CommunicationPreference communicationPreference) {}

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
                            p.name(), p.description(), p.imageUrl(), imagesOf(p), p.active(), p.createdAt(), visible);
                })
                .filter(pv -> !activeOnly || !pv.variants().isEmpty())
                .filter(pv -> brandId == null || Objects.equals(pv.brandId(), brandId))
                .filter(pv -> categoryId == null || Objects.equals(pv.categoryId(), categoryId))
                .toList();
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
                           String imageUrl, List<String> images, List<VariantSpec> variants) {
        requireText(name, "Product name is required");
        validateBrandCategory(salonId, brandId, categoryId);
        var gallery = resolveImages(imageUrl, images);
        var cover = gallery.isEmpty() ? null : gallery.get(0);
        var product = productRepo.save(new Product(null, salonId, brandId, categoryId, name.trim(),
                description, cover, true, Instant.now(),
                gallery.stream().map(Product.ProductImage::new).toList()));
        var saved = (variants == null ? List.<VariantSpec>of() : variants).stream()
                .map(v -> variantRepo.save(newVariant(null, product.id(), salonId, v)))
                .toList();
        log.info("[ShopManager] Product added id={} salon={} variants={} images={}", product.id(), salonId, saved.size(), gallery.size());
        return toProductView(product, saved);
    }

    @Transactional
    Optional<ProductView> updateProduct(UUID salonId, Long productId, Long brandId, Long categoryId,
                                        String name, String description, String imageUrl, List<String> images,
                                        boolean active, List<VariantSpec> variants) {
        requireText(name, "Product name is required");
        validateBrandCategory(salonId, brandId, categoryId);
        return productRepo.findByIdAndSalonId(productId, salonId).map(existing -> {
            var gallery = resolveImages(imageUrl, images);
            var cover = gallery.isEmpty() ? null : gallery.get(0);
            var updated = productRepo.save(new Product(existing.id(), salonId, brandId, categoryId, name.trim(),
                    description, cover, active, existing.createdAt(),
                    gallery.stream().map(Product.ProductImage::new).toList()));

            var specs = variants == null ? List.<VariantSpec>of() : variants;
            var keepIds = specs.stream().map(VariantSpec::id).filter(Objects::nonNull).collect(Collectors.toSet());
            variantRepo.findByProductId(productId).stream()
                    .filter(v -> !keepIds.contains(v.id()))
                    .forEach(v -> variantRepo.deleteById(v.id()));

            var result = specs.stream()
                    .map(v -> variantRepo.save(newVariant(v.id(), productId, salonId, v)))
                    .toList();
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
                    v.price(), v.compareAtPrice(), v.currency(), Math.max(0, quantityOnHand), Math.max(0, reorderLevel), v.active()));
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
        if (req == null || req.items() == null || req.items().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Your cart is empty");
        }
        if (isBlank(req.customerName()) || isBlank(req.customerEmail())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name and email are required");
        }

        var lines = new ArrayList<ShopOrder.OrderLine>();
        BigDecimal subtotal = BigDecimal.ZERO;
        String currency = null;

        for (var item : req.items()) {
            if (item.variantId() == null || item.quantity() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid cart item");
            }
            var variant = variantRepo.findByIdAndSalonId(item.variantId(), salonId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product option not found"));
            var product = productRepo.findByIdAndSalonId(variant.productId(), salonId)
                    .filter(Product::active)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "This product is no longer available"));

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
            lines.add(new ShopOrder.OrderLine(null, product.id(), variant.id(), product.name(), variant.label(),
                    unitPrice, item.quantity(), lineTotal));
        }

        var now = Instant.now();
        var finalCurrency = currency != null ? currency : DEFAULT_CURRENCY;
        var pref = req.communicationPreference() != null ? req.communicationPreference() : CommunicationPreference.IMPORTANT_ONLY;
        var order = new ShopOrder(null, salonId, generateOrderNumber(),
                req.customerName().trim(), req.customerEmail().trim(), trimToNull(req.customerPhone()),
                req.shippingAddress(), OrderStatus.NEW, PaymentStatus.PAID,
                "DUMMY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT),
                subtotal, finalCurrency, now, null, null, pref,
                null, null, null,
                null, null, null, null,
                null, null, null,
                lines);
        var saved = orderRepo.save(order);

        for (var line : saved.lines()) {
            var label = line.variantLabel() != null && !line.variantLabel().isBlank() ? " (" + line.variantLabel() + ")" : "";
            activityRepo.save(new OrderLineActivity(null, line.id(), salonId, OrderLineActivityType.LINE_CREATED,
                    line.quantity() + " × " + line.productName() + label + " ordered", "customer", now));
        }

        var contact = salonContact(salonId);
        eventPublisher.publishEvent(new OrderPlacedEvent(saved.id(), salonId, saved.orderNumber(),
                saved.customerName(), saved.customerEmail(), saved.customerPhone(),
                saved.lines().stream().mapToInt(ShopOrder.OrderLine::quantity).sum(),
                saved.subtotal(), saved.currency(), contact.name(), contact.phone(), contact.email(),
                saved.communicationPreference()));

        recordOrderActivity(saved.id(), salonId, "ORDER_PLACED",
                "Order " + saved.orderNumber() + " placed by " + saved.customerName(),
                "customer", false, saved.customerEmail(), saved.customerPhone());
        log.info("[ShopManager] Order placed id={} number={} salon={} lines={} subtotal={} {}",
                saved.id(), saved.orderNumber(), salonId, saved.lines().size(), saved.subtotal(), saved.currency());
        return getOrder(salonId, saved.id()).orElseThrow();
    }

    @Transactional
    Optional<OrderView> updateOrderStatus(UUID salonId, Long orderId, OrderStatus newStatus, String actor) {
        var order = orderRepo.findByIdAndSalonId(orderId, salonId).orElse(null);
        if (order == null) return Optional.empty();
        if (order.status() == newStatus) return getOrder(salonId, orderId);

        if (newStatus == OrderStatus.CANCELLED) {
            var current = order.status();
            if (current == OrderStatus.SHIPPED || current == OrderStatus.DELIVERED
                    || current == OrderStatus.FULFILLED) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Cannot cancel a " + current.name().toLowerCase() + " order. Start a return instead.");
            }
        }

        jdbcClient.sql("UPDATE shop_order SET status = :s WHERE id = :id AND salon_id = :salon")
                .param("s", newStatus.name())
                .param("id", orderId)
                .param("salon", salonId)
                .update();

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

        jdbcClient.sql("UPDATE shop_order SET tracking_carrier = :c, tracking_number = :t WHERE id = :id AND salon_id = :salon")
                .param("c", trimToNull(carrier))
                .param("t", trimToNull(trackingNumber))
                .param("id", orderId)
                .param("salon", salonId)
                .update();

        if (order.status() != OrderStatus.SHIPPED && order.status() != OrderStatus.DELIVERED
                && order.status() != OrderStatus.FULFILLED) {
            jdbcClient.sql("UPDATE shop_order SET status = 'SHIPPED' WHERE id = :id AND salon_id = :salon")
                    .param("id", orderId).param("salon", salonId).update();
        }

        var msg = "Shipment dispatched"
                + (carrier != null && !carrier.isBlank() ? " via " + carrier.trim() : "")
                + (trackingNumber != null && !trackingNumber.isBlank() ? " — tracking: " + trackingNumber.trim() : "");
        recordOrderActivity(orderId, salonId, "SHIPMENT_CREATED", msg, "admin", true,
                order.customerEmail(), order.customerPhone());
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
        var ref = "CN-" + Long.toString(System.nanoTime() & Long.MAX_VALUE, 36).toUpperCase(Locale.ROOT);
        var now = Instant.now();
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
                "Refund of " + order.refundAmount() + " " + order.currency() + " processed — credit note " + ref + " created",
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
        var now = Instant.now();
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
        var now = Instant.now();
        jdbcClient.sql("UPDATE shop_order SET return_status = :s, return_notes = :n, return_updated_at = :at WHERE id = :id AND salon_id = :salon")
                .param("s", status)
                .param("n", trimToNull(notes))
                .param("at", now)
                .param("id", orderId)
                .param("salon", salonId)
                .update();
        boolean notify = "APPROVED".equals(status) || "ACCEPTED".equals(status);
        recordOrderActivity(orderId, salonId, "RETURN_UPDATED",
                "Return → " + status.toLowerCase().replace('_', ' '),
                "admin", notify, order.customerEmail(), order.customerPhone());
        log.info("[ShopManager] Return status orderId={} → {}", orderId, status);
        return getOrder(salonId, orderId).orElseThrow();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private ProductVariant newVariant(Long id, Long productId, UUID salonId, VariantSpec v) {
        var currency = v.currency() != null && !v.currency().isBlank() ? v.currency().trim().toUpperCase(Locale.ROOT) : DEFAULT_CURRENCY;
        return new ProductVariant(id, productId, salonId,
                trimToNull(v.sku()), trimToNull(v.label()),
                v.price() != null ? v.price() : BigDecimal.ZERO,
                v.compareAtPrice(),
                currency,
                v.quantityOnHand() != null ? Math.max(0, v.quantityOnHand()) : 0,
                v.reorderLevel() != null ? Math.max(0, v.reorderLevel()) : 0,
                v.active() == null || v.active());
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
                p.name(), p.description(), p.imageUrl(), imagesOf(p), p.active(), p.createdAt(), variants);
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
