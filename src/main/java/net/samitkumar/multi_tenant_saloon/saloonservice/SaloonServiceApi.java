package net.samitkumar.multi_tenant_saloon.saloonservice;

import java.util.Optional;
import java.util.UUID;

public interface SaloonServiceApi {
    Optional<ServiceItem> findByIdAndSaloonId(Long id, UUID saloonId);
}
