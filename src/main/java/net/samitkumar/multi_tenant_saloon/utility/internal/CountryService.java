package net.samitkumar.multi_tenant_saloon.utility.internal;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import net.samitkumar.multi_tenant_saloon.utility.Country;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
class CountryService {

    private record RawCountry(String name, String code, String dialCode, String currencyCode) {}
    private record RawCurrency(String code, String name, String symbol) {}

    private final List<Country> countries;

    CountryService(
            @Value("${spring.application.utility.static-geo-data}") Resource geoResource,
            @Value("${spring.application.utility.static-currency-data}") Resource currencyResource,
            ObjectMapper objectMapper) {
        try {
            Map<String, RawCurrency> currencyMap = objectMapper
                    .readValue(currencyResource.getInputStream(), new TypeReference<List<RawCurrency>>() {})
                    .stream()
                    .collect(Collectors.toMap(RawCurrency::code, c -> c));

            countries = objectMapper
                    .readValue(geoResource.getInputStream(), new TypeReference<List<RawCountry>>() {})
                    .stream()
                    .map(c -> {
                        RawCurrency currency = currencyMap.get(c.currencyCode());
                        return new Country(
                                c.name(), c.code(), c.dialCode(), c.currencyCode(),
                                currency != null ? currency.name() : null,
                                currency != null ? currency.symbol() : null
                        );
                    })
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to load country/currency data", e);
        }
    }

    List<Country> findAll() {
        return countries;
    }
}
