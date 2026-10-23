package net.samitkumar.multi_tenant_salon.shop.internal;

import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.utility.Country;
import net.samitkumar.multi_tenant_salon.utility.CountryApi;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * The salon's own currency — that of the country the salon is in ({@code location.country} holds
 * the country's name). New products and shipping methods default to it; the owner may still price
 * a product or method in another currency on purpose.
 */
@Component
class ShopCurrency {
    static final String FALLBACK = "USD";

    private final SalonApi salons;
    // Module tests may bootstrap the shop without the utility module.
    private final ObjectProvider<CountryApi> countries;

    ShopCurrency(SalonApi salons, ObjectProvider<CountryApi> countries) {
        this.salons = salons;
        this.countries = countries;
    }

    String of(UUID salonId) {
        var api = countries.getIfAvailable();
        if (api == null) return FALLBACK;
        return salons.findById(salonId)
                .map(s -> s.location() == null ? null : s.location().country())
                .flatMap(api::findByName)
                .map(Country::currencyCode)
                .filter(c -> !c.isBlank())
                .orElse(FALLBACK);
    }
}
