package net.samitkumar.multi_tenant_salon.salonservice;

import java.util.Optional;
import java.util.UUID;

public interface SalonServiceApi {
    Optional<ServiceItem> findByIdAndSalonId(Long id, UUID salonId);
}
