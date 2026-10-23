package net.samitkumar.multi_tenant_salon.shop.internal;

import net.samitkumar.multi_tenant_salon.shop.ShippingMethod;
import net.samitkumar.multi_tenant_salon.shop.ShopOrder;
import net.samitkumar.multi_tenant_salon.utility.CountryApi;
import net.samitkumar.multi_tenant_salon.utility.Country;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The salon's shipping methods: the owner's CRUD, and the rule evaluation the storefront quote and
 * {@code ShopManager.placeOrder} share — so the price the customer sees is the price they are charged.
 */
@Service
class ShippingMethodService {

    private final ShippingMethodRepository methods;
    // Module tests may bootstrap the shop alone; then only ISO codes resolve as destinations.
    private final ObjectProvider<CountryApi> countries;
    private final ShopCurrency shopCurrency;

    ShippingMethodService(ShippingMethodRepository methods, ObjectProvider<CountryApi> countries, ShopCurrency shopCurrency) {
        this.methods = methods;
        this.countries = countries;
        this.shopCurrency = shopCurrency;
    }

    record ShippingMethodRequest(String name, String description, String carrier, ShippingMethod.DeliveryType deliveryType,
                                 BigDecimal price, BigDecimal freeOver, BigDecimal minOrderValue, BigDecimal maxOrderValue,
                                 Integer minItems, Integer maxItems, Integer minWeightGrams, Integer maxWeightGrams,
                                 String currency, Integer minDeliveryDays, Integer maxDeliveryDays,
                                 Integer sortOrder, Boolean active, Collection<String> countries) {}

    /** What a cart is evaluated on: its currency, value, unit count and gross weight. */
    record Cart(String currency, BigDecimal subtotal, int itemCount, int weightGrams) {}

    /** One method a cart qualifies for, priced for that cart. */
    record ShippingOption(Long id, String name, String description, String carrier,
                          ShippingMethod.DeliveryType deliveryType, BigDecimal cost, String currency, boolean free,
                          Integer minDeliveryDays, Integer maxDeliveryDays) {}

    /**
     * {@code configured} is false when the salon has no active method — shipping is then free, as it
     * was before methods existed. With methods configured, an empty {@code options} means the salon
     * does not ship this cart to that destination.
     */
    record ShippingQuote(boolean configured, List<ShippingOption> options) {}

    /** The method an order ships with, snapshotted onto the order. */
    record SelectedShipping(Long methodId, String name, BigDecimal cost) {
        static final SelectedShipping NONE = new SelectedShipping(null, null, BigDecimal.ZERO);
    }

    // ── Owner CRUD ───────────────────────────────────────────────────────────

    List<ShippingMethod> list(UUID salonId) {
        return methods.findBySalonIdOrderBySortOrderAscNameAsc(salonId);
    }

    ShippingMethod create(UUID salonId, ShippingMethodRequest req) {
        return methods.save(toMethod(null, salonId, req, Instant.now(), shopCurrency.of(salonId)));
    }

    Optional<ShippingMethod> update(UUID salonId, Long id, ShippingMethodRequest req) {
        return methods.findByIdAndSalonId(id, salonId)
                .map(existing -> methods.save(toMethod(existing.id(), salonId, req, existing.createdAt(), shopCurrency.of(salonId))));
    }

    void delete(UUID salonId, Long id) {
        methods.findByIdAndSalonId(id, salonId).ifPresent(m -> methods.deleteById(m.id()));
    }

    // ── Storefront ───────────────────────────────────────────────────────────

    ShippingQuote quote(UUID salonId, String country, Cart cart) {
        var active = active(salonId);
        if (active.isEmpty()) return new ShippingQuote(false, List.of());
        var code = countryCode(country);
        var salonCurrency = shopCurrency.of(salonId);
        var cartCurrency = cart.currency() != null ? cart.currency() : salonCurrency;
        var options = active.stream()
                // A method without a currency (made before currencies existed) prices in the salon's.
                .filter(m -> (m.currency() != null ? m.currency() : salonCurrency).equalsIgnoreCase(cartCurrency))
                .filter(m -> m.accepts(code, cart.subtotal(), cart.itemCount(), cart.weightGrams()))
                .map(m -> {
                    var cost = m.costFor(cart.subtotal());
                    return new ShippingOption(m.id(), m.name(), m.description(), m.carrier(), m.deliveryType(),
                            cost, cartCurrency, cost.signum() == 0, m.minDeliveryDays(), m.maxDeliveryDays());
                })
                .sorted(Comparator.comparing(ShippingOption::cost))
                .toList();
        return new ShippingQuote(true, options);
    }

    /**
     * The shipping an order to {@code address} pays. No active methods → free (legacy behaviour).
     * With methods, {@code methodId} must be one the cart qualifies for; without one (API callers
     * such as the MCP shop app) the cheapest qualifying method is used.
     */
    SelectedShipping select(UUID salonId, Long methodId, ShopOrder.ShippingAddress address, Cart cart) {
        if (address == null) return SelectedShipping.NONE;
        var quote = quote(salonId, address.country(), cart);
        if (!quote.configured()) return SelectedShipping.NONE;
        if (quote.options().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "We can't ship this order to " + (isBlank(address.country()) ? "that address" : address.country().trim())
                            + ". Choose collect in salon instead.");
        }
        var chosen = methodId == null
                ? quote.options().getFirst()
                : quote.options().stream().filter(o -> o.id().equals(methodId)).findFirst()
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                                "That shipping option isn't available for this order any more. Please choose another."));
        return new SelectedShipping(chosen.id(), chosen.name(), chosen.cost());
    }

    private List<ShippingMethod> active(UUID salonId) {
        return methods.findBySalonIdOrderBySortOrderAscNameAsc(salonId).stream().filter(ShippingMethod::active).toList();
    }

    /** The address carries the country's name (the storefront's dropdown); methods store ISO codes. */
    private String countryCode(String country) {
        if (isBlank(country)) return null;
        var value = country.trim();
        if (value.length() == 2) return value.toUpperCase(Locale.ROOT);
        var api = countries.getIfAvailable();
        return api == null ? null : api.findByName(value).map(Country::code).orElse(null);
    }

    private static ShippingMethod toMethod(Long id, UUID salonId, ShippingMethodRequest req, Instant createdAt,
                                           String salonCurrency) {
        if (req == null || isBlank(req.name())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Shipping method name is required");
        }
        nonNegative(req.price(), "Price");
        nonNegative(req.freeOver(), "Free shipping threshold");
        nonNegative(req.minOrderValue(), "Minimum order value");
        nonNegative(req.maxOrderValue(), "Maximum order value");
        nonNegative(req.minItems(), "Minimum items");
        nonNegative(req.maxItems(), "Maximum items");
        nonNegative(req.minWeightGrams(), "Minimum weight");
        nonNegative(req.maxWeightGrams(), "Maximum weight");
        nonNegative(req.minDeliveryDays(), "Minimum delivery days");
        nonNegative(req.maxDeliveryDays(), "Maximum delivery days");
        if (req.minOrderValue() != null && req.maxOrderValue() != null && req.minOrderValue().compareTo(req.maxOrderValue()) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Minimum order value can't be above the maximum");
        }
        if (req.minItems() != null && req.maxItems() != null && req.minItems() > req.maxItems()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Minimum items can't be above the maximum");
        }
        if (req.minWeightGrams() != null && req.maxWeightGrams() != null && req.minWeightGrams() > req.maxWeightGrams()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Minimum weight can't be above the maximum");
        }
        var currency = isBlank(req.currency()) ? salonCurrency : req.currency().trim().toUpperCase(Locale.ROOT);
        if (!currency.matches("[A-Z]{3}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Currency must be a 3-letter ISO code");
        }
        if (req.minDeliveryDays() != null && req.maxDeliveryDays() != null && req.minDeliveryDays() > req.maxDeliveryDays()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Minimum delivery days can't be above the maximum");
        }
        var codes = req.countries() == null ? java.util.Set.<ShippingMethod.CountryRef>of() : req.countries().stream()
                .filter(c -> !isBlank(c))
                .map(c -> c.trim().toUpperCase(Locale.ROOT))
                .peek(c -> {
                    if (!c.matches("[A-Z]{2}")) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Countries must be 2-letter ISO codes, got '" + c + "'");
                    }
                })
                .map(ShippingMethod.CountryRef::new)
                .collect(Collectors.toSet());
        return new ShippingMethod(id, salonId, req.name().trim(), trimToNull(req.description()), trimToNull(req.carrier()),
                req.deliveryType(), req.price() == null ? BigDecimal.ZERO : req.price(), req.freeOver(),
                req.minOrderValue(), req.maxOrderValue(), req.minItems(), req.maxItems(),
                req.minWeightGrams(), req.maxWeightGrams(), currency,
                req.minDeliveryDays(), req.maxDeliveryDays(),
                req.sortOrder() == null ? 0 : req.sortOrder(), req.active() == null || req.active(), createdAt, codes);
    }

    private static void nonNegative(Number value, String field) {
        if (value != null && value.doubleValue() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " can't be negative");
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String trimToNull(String s) {
        return isBlank(s) ? null : s.trim();
    }
}
