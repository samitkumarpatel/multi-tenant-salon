package net.samitkumar.multi_tenant_salon.dashboard.internal;

import net.samitkumar.multi_tenant_salon.booking.BookingApi;
import net.samitkumar.multi_tenant_salon.dashboard.DashboardNotificationRequestedEvent;
import net.samitkumar.multi_tenant_salon.dashboard.DashboardSettings;
import net.samitkumar.multi_tenant_salon.dashboard.PosSale;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.shop.ShopCatalogApi;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
class DashboardManager {
    record CashierItem(PosSale.SourceType sourceType, Long sourceId, String name, String detail,
                       BigDecimal price, String currency, Integer availableQuantity) {}
    record SaleItemRequest(PosSale.SourceType sourceType, Long sourceId, int quantity) {}

    private final DashboardSettingsRepository settingsRepository;
    private final PosSaleRepository saleRepository;
    private final SalonApi salonApi;
    private final SalonServiceApi serviceApi;
    private final ShopCatalogApi shopApi;
    private final BookingApi bookingApi;
    private final ApplicationEventPublisher events;

    DashboardManager(DashboardSettingsRepository settingsRepository, PosSaleRepository saleRepository,
                     SalonApi salonApi, SalonServiceApi serviceApi, ShopCatalogApi shopApi,
                     BookingApi bookingApi, ApplicationEventPublisher events) {
        this.settingsRepository = settingsRepository;
        this.saleRepository = saleRepository;
        this.salonApi = salonApi;
        this.serviceApi = serviceApi;
        this.shopApi = shopApi;
        this.bookingApi = bookingApi;
        this.events = events;
    }

    DashboardSettings settings(UUID salonId) {
        requireDashboard(salonId);
        return settingsRepository.findById(salonId).orElseGet(() -> defaults(salonId));
    }

    DashboardSettings updateSettings(UUID salonId, boolean bookingManagement, boolean cashier,
                                     boolean notifications, String defaultNotification) {
        var salon = requireDashboard(salonId);
        if (bookingManagement && !hasFeature(salon, SalonFeature.BOOKING)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Enable Online Booking before enabling booking management");
        }
        var saved = new DashboardSettings(salonId, bookingManagement, cashier, notifications,
                trimToNull(defaultNotification), Instant.now());
        return settingsRepository.save(saved);
    }

    List<CashierItem> cashierItems(UUID salonId) {
        var salon = requireDashboard(salonId);
        if (!settings(salonId).cashierEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cashier is disabled");
        }
        var items = new ArrayList<CashierItem>();
        serviceApi.findAllBySalonId(salonId).stream().filter(s -> s.active() && s.price() != null).forEach(s ->
                items.add(new CashierItem(PosSale.SourceType.SERVICE, s.id(), s.name(), "Service",
                        s.price(), s.currency() == null ? "USD" : s.currency(), null)));
        if (hasFeature(salon, SalonFeature.WEBSHOP)) {
            shopApi.findAvailableItems(salonId).forEach(p -> items.add(new CashierItem(
                    PosSale.SourceType.PRODUCT, p.variantId(), p.name(), p.variantLabel(), p.price(),
                    p.currency(), p.quantityOnHand())));
        }
        return items;
    }

    @Transactional
    PosSale createSale(UUID salonId, String customerName, PosSale.PaymentMethod paymentMethod,
                       List<SaleItemRequest> requestedItems) {
        requireDashboard(salonId);
        if (!settings(salonId).cashierEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cashier is disabled");
        }
        if (paymentMethod == null || requestedItems == null || requestedItems.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment method and at least one item are required");
        }

        var lines = new ArrayList<PosSale.Line>();
        String currency = null;
        BigDecimal total = BigDecimal.ZERO;
        for (var requested : requestedItems) {
            if (requested == null || requested.sourceType() == null || requested.sourceId() == null || requested.quantity() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid sale item");
            }
            String name;
            BigDecimal price;
            String itemCurrency;
            if (requested.sourceType() == PosSale.SourceType.SERVICE) {
                var service = serviceApi.findByIdAndSalonId(requested.sourceId(), salonId)
                        .filter(s -> s.active() && s.price() != null)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));
                name = service.name();
                price = service.price();
                itemCurrency = service.currency() == null ? "USD" : service.currency();
            } else {
                var product = shopApi.findAvailableItem(salonId, requested.sourceId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
                name = product.variantLabel() == null || product.variantLabel().isBlank()
                        ? product.name() : product.name() + " · " + product.variantLabel();
                price = product.price();
                itemCurrency = product.currency();
                shopApi.decrementStock(salonId, requested.sourceId(), requested.quantity());
            }
            if (currency == null) currency = itemCurrency.toUpperCase(Locale.ROOT);
            if (!currency.equalsIgnoreCase(itemCurrency)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "All sale items must use the same currency");
            }
            var lineTotal = price.multiply(BigDecimal.valueOf(requested.quantity()));
            total = total.add(lineTotal);
            lines.add(new PosSale.Line(null, requested.sourceType(), requested.sourceId(), name,
                    price, requested.quantity(), lineTotal));
        }
        var saleNumber = "POS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        return saleRepository.save(new PosSale(null, salonId, saleNumber, trimToNull(customerName),
                paymentMethod, total, currency == null ? "USD" : currency, Instant.now(), lines));
    }

    List<PosSale> recentSales(UUID salonId) {
        requireDashboard(salonId);
        return saleRepository.findTop50BySalonIdOrderByCreatedAtDesc(salonId);
    }

    void notifyBookingCustomer(UUID salonId, Long bookingId, String subject, String message) {
        var salon = requireDashboard(salonId);
        var settings = settings(salonId);
        if (!settings.notificationsEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Dashboard notifications are disabled");
        }
        var booking = bookingApi.findById(salonId, bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        if (booking.customerEmail() == null || booking.customerEmail().isBlank()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This customer has no email address");
        }
        var body = trimToNull(message);
        if (body == null) body = settings.defaultNotification();
        if (body == null) body = "We have an update about your appointment. Please contact the salon if you have any questions.";
        var notificationSubject = trimToNull(subject);
        if (notificationSubject == null) notificationSubject = salon.name() + " — appointment update";
        events.publishEvent(new DashboardNotificationRequestedEvent(salonId, bookingId, salon.name(),
                booking.customerName(), booking.customerEmail(), notificationSubject, body, Instant.now()));
    }

    private Salon requireDashboard(UUID salonId) {
        var salon = salonApi.findById(salonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Salon not found"));
        if (!hasFeature(salon, SalonFeature.DASHBOARD)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Dashboard feature is not enabled");
        }
        return salon;
    }

    private boolean hasFeature(Salon salon, SalonFeature feature) {
        return salon.features().stream().anyMatch(f -> f.feature() == feature);
    }

    private DashboardSettings defaults(UUID salonId) {
        var salon = salonApi.findById(salonId).orElseThrow();
        return new DashboardSettings(salonId, hasFeature(salon, SalonFeature.BOOKING), true, true, null, null);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
