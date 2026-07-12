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

@Service
class CountryService {

    private final List<Country> countries;

    CountryService(@Value("${spring.application.utility.static-geo-data}") Resource resource,
                   ObjectMapper objectMapper) {
        try {
            countries = objectMapper.readValue(resource.getInputStream(), new TypeReference<>() {});
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to load geo data from " + resource.getDescription(), e);
        }
    }

    List<Country> findAll() {
        return countries;
    }
}
