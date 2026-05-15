package net.samitkumar.multi_tenant_saloon.saloonservice.internal;

import net.samitkumar.multi_tenant_saloon.saloonservice.ServiceItem;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

interface SaloonServiceRepository extends MongoRepository<ServiceItem, String> {
    List<ServiceItem> findBySaloonId(String saloonId);
}
