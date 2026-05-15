package net.samitkumar.multi_tenant_saloon.saloonservice.internal;

import net.samitkumar.multi_tenant_saloon.saloonservice.ServiceCategory;
import net.samitkumar.multi_tenant_saloon.saloonservice.ServiceItem;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
class SaloonServiceManager {

    private final SaloonServiceRepository repository;

    SaloonServiceManager(SaloonServiceRepository repository) {
        this.repository = repository;
    }

    List<ServiceItem> findBySaloonId(String saloonId) {
        return repository.findBySaloonId(saloonId);
    }

    Optional<ServiceItem> findById(String saloonId, String serviceId) {
        return repository.findById(serviceId).filter(s -> s.saloonId().equals(saloonId));
    }

    ServiceItem add(String saloonId, String name, String description, BigDecimal price, String currency,
                    int durationMinutes, ServiceCategory category, List<String> assignedStaffIds) {
        var item = new ServiceItem(null, saloonId, name, description, price, currency, durationMinutes,
                category, true, assignedStaffIds, Instant.now());
        return repository.save(item);
    }

    Optional<ServiceItem> update(String saloonId, String serviceId, String name, String description,
                                 BigDecimal price, String currency, int durationMinutes,
                                 ServiceCategory category, boolean active, List<String> assignedStaffIds) {
        return repository.findById(serviceId)
                .filter(s -> s.saloonId().equals(saloonId))
                .map(existing -> {
                    var updated = new ServiceItem(existing.id(), existing.saloonId(), name, description,
                            price, currency, durationMinutes, category, active, assignedStaffIds,
                            existing.createdAt());
                    return repository.save(updated);
                });
    }

    void remove(String saloonId, String serviceId) {
        repository.findById(serviceId)
                .filter(s -> s.saloonId().equals(saloonId))
                .ifPresent(s -> repository.deleteById(serviceId));
    }
}
