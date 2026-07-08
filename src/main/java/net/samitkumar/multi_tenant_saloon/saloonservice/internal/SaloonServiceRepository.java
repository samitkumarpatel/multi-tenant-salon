package net.samitkumar.multi_tenant_saloon.saloonservice.internal;

import net.samitkumar.multi_tenant_saloon.saloonservice.ServiceItem;
import org.springframework.data.repository.ListCrudRepository;

import java.util.List;
import java.util.UUID;

interface SaloonServiceRepository extends ListCrudRepository<ServiceItem, Long> {
    List<ServiceItem> findBySaloonId(UUID saloonId);
}
