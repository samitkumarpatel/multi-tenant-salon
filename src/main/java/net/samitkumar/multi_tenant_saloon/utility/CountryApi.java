package net.samitkumar.multi_tenant_saloon.utility;

import java.util.Optional;

public interface CountryApi {
    Optional<Country> findByName(String name);
}
