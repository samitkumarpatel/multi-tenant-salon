package net.samitkumar.multi_tenant_salon.salonservice.internal;

import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import org.springframework.data.repository.ListCrudRepository;

import java.util.List;
import java.util.UUID;

interface SalonServiceRepository extends ListCrudRepository<ServiceItem, Long> {
    List<ServiceItem> findBySalonId(UUID salonId);
}
