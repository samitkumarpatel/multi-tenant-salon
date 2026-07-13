package net.samitkumar.multi_tenant_saloon.utility.internal;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import net.samitkumar.multi_tenant_saloon.utility.Currency;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

@Service
class CurrencyService {

    private final List<Currency> currencies;

    CurrencyService(@Value("${spring.application.utility.static-currency-data}") Resource resource,
                    ObjectMapper objectMapper) {
        try {
            currencies = objectMapper.readValue(resource.getInputStream(), new TypeReference<>() {});
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to load currency data from " + resource.getDescription(), e);
        }
    }

    List<Currency> findAll() {
        return currencies;
    }
}
