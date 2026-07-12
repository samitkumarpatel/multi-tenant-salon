package net.samitkumar.multi_tenant_saloon.saloonservice.internal;

import net.samitkumar.multi_tenant_saloon.saloonservice.ServiceCategory;
import net.samitkumar.multi_tenant_saloon.saloonservice.ServiceItem;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
class SaloonServiceManager {

    private final SaloonServiceRepository repository;

    SaloonServiceManager(SaloonServiceRepository repository) {
        this.repository = repository;
    }

    List<ServiceItem> findBySaloonId(UUID saloonId) {
        return repository.findBySaloonId(saloonId);
    }

    Optional<ServiceItem> findById(UUID saloonId, Long serviceId) {
        return repository.findById(serviceId).filter(s -> s.saloonId().equals(saloonId));
    }

    ServiceItem add(UUID saloonId, String name, String description, BigDecimal price, String currency,
                    int durationMinutes, ServiceCategory category, List<String> assignedStaffIds) {
        var staffList = assignedStaffIds != null
                ? assignedStaffIds.stream().map(ServiceItem.AssignedStaff::new).toList()
                : List.<ServiceItem.AssignedStaff>of();
        var item = new ServiceItem(null, saloonId, name, description, price, currency, durationMinutes,
                category, true, staffList, Instant.now());
        return repository.save(item);
    }

    Optional<ServiceItem> update(UUID saloonId, Long serviceId, String name, String description,
                                 BigDecimal price, String currency, int durationMinutes,
                                 ServiceCategory category, boolean active, List<String> assignedStaffIds) {
        var staffList = assignedStaffIds != null
                ? assignedStaffIds.stream().map(ServiceItem.AssignedStaff::new).toList()
                : List.<ServiceItem.AssignedStaff>of();
        return repository.findById(serviceId)
                .filter(s -> s.saloonId().equals(saloonId))
                .map(existing -> {
                    var updated = new ServiceItem(existing.id(), existing.saloonId(), name, description,
                            price, currency, durationMinutes, category, active, staffList,
                            existing.createdAt());
                    return repository.save(updated);
                });
    }

    void remove(UUID saloonId, Long serviceId) {
        repository.findById(serviceId)
                .filter(s -> s.saloonId().equals(saloonId))
                .ifPresent(s -> repository.deleteById(serviceId));
    }
}
