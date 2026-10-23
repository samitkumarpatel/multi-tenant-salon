package net.samitkumar.multi_tenant_salon.shop;

import com.fasterxml.jackson.annotation.JsonValue;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * A way the salon ships web-shop orders, with Shipmondo-style rules deciding when it is offered.
 * Every criterion is optional; a method is eligible for a cart only when all the ones it sets match:
 * <ul>
 *   <li>{@code countries} — ISO 3166-1 alpha-2 destination codes; empty ships everywhere</li>
 *   <li>{@code minOrderValue}/{@code maxOrderValue} — the cart subtotal, inclusive</li>
 *   <li>{@code minItems}/{@code maxItems} — the total quantity in the cart, inclusive</li>
 *   <li>{@code minWeightGrams}/{@code maxWeightGrams} — the cart's gross weight, inclusive</li>
 *   <li>{@code currency} — only carts priced in this currency (null = the salon's currency)</li>
 * </ul>
 * {@code price} is in {@code currency} and becomes 0 once the subtotal reaches
 * {@code freeOver}. Orders snapshot the method's name and the cost they paid, so editing or
 * deleting a method never changes a placed order.
 */
@Table("shop_shipping_method")
public record ShippingMethod(
        @Id Long id,
        UUID salonId,
        String name,
        String description,
        String carrier,
        DeliveryType deliveryType,
        BigDecimal price,
        BigDecimal freeOver,
        BigDecimal minOrderValue,
        BigDecimal maxOrderValue,
        Integer minItems,
        Integer maxItems,
        Integer minWeightGrams,
        Integer maxWeightGrams,
        String currency,
        Integer minDeliveryDays,
        Integer maxDeliveryDays,
        int sortOrder,
        boolean active,
        Instant createdAt,
        @MappedCollection(idColumn = "shipping_method_id") Set<CountryRef> countries
) {
    public ShippingMethod {
        countries = countries != null ? Set.copyOf(countries) : Set.of();
        if (deliveryType == null) deliveryType = DeliveryType.HOME;
        if (price == null) price = BigDecimal.ZERO;
    }

    public enum DeliveryType { HOME, PICKUP_POINT, BUSINESS }

    /** A destination country code. Serializes as a plain string (JSON: {@code "DK"}). */
    @Table("shop_shipping_method_country")
    public record CountryRef(@JsonValue @Column("country_code") String code) {}

    /**
     * Whether this method may carry a cart of {@code subtotal} / {@code itemCount} / {@code weightGrams}
     * to {@code countryCode}. Currency is matched by the caller, which knows the salon's default.
     */
    public boolean accepts(String countryCode, BigDecimal subtotal, int itemCount, int weightGrams) {
        if (!active) return false;
        if (!countries.isEmpty()) {
            if (countryCode == null) return false;
            var code = countryCode.toUpperCase(Locale.ROOT);
            if (countries.stream().noneMatch(c -> c.code().equals(code))) return false;
        }
        if (minOrderValue != null && subtotal.compareTo(minOrderValue) < 0) return false;
        if (maxOrderValue != null && subtotal.compareTo(maxOrderValue) > 0) return false;
        if (minItems != null && itemCount < minItems) return false;
        if (maxItems != null && itemCount > maxItems) return false;
        if (minWeightGrams != null && weightGrams < minWeightGrams) return false;
        return maxWeightGrams == null || weightGrams <= maxWeightGrams;
    }

    /** What the customer pays for this method on an order of {@code subtotal}. */
    public BigDecimal costFor(BigDecimal subtotal) {
        return freeOver != null && subtotal.compareTo(freeOver) >= 0 ? BigDecimal.ZERO : price;
    }
}
