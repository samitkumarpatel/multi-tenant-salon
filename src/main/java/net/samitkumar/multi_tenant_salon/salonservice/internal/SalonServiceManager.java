package net.samitkumar.multi_tenant_salon.salonservice.internal;

import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceCategory;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
public class SalonServiceManager implements SalonServiceApi {

    private final SalonServiceRepository repository;

    SalonServiceManager(SalonServiceRepository repository) {
        this.repository = repository;
    }

    List<ServiceItem> findBySalonId(UUID salonId) {
        return repository.findBySalonId(salonId);
    }

    @Override
    public Optional<ServiceItem> findByIdAndSalonId(Long serviceId, UUID salonId) {
        return repository.findById(serviceId).filter(s -> s.salonId().equals(salonId));
    }

    ServiceItem add(UUID salonId, String name, String description, BigDecimal price, String currency,
                    Integer durationMinutes, ServiceCategory category, List<String> assignedStaffIds) {
        log.info("[SalonServiceManager] Adding service '{}' category={} salon={}", name, category, salonId);
        var staffList = assignedStaffIds != null
                ? assignedStaffIds.stream().map(ServiceItem.AssignedStaff::new).toList()
                : List.<ServiceItem.AssignedStaff>of();
        var item = new ServiceItem(null, salonId, name, description, price, currency, durationMinutes,
                category, true, staffList, Instant.now());
        var saved = repository.save(item);
        log.info("[SalonServiceManager] Service added id={} salon={}", saved.id(), salonId);
        return saved;
    }

    Optional<ServiceItem> update(UUID salonId, Long serviceId, String name, String description,
                                 BigDecimal price, String currency, Integer durationMinutes,
                                 ServiceCategory category, boolean active, List<String> assignedStaffIds) {
        log.info("[SalonServiceManager] Updating service id={} salon={} active={}", serviceId, salonId, active);
        var staffList = assignedStaffIds != null
                ? assignedStaffIds.stream().map(ServiceItem.AssignedStaff::new).toList()
                : List.<ServiceItem.AssignedStaff>of();
        return repository.findById(serviceId)
                .filter(s -> s.salonId().equals(salonId))
                .map(existing -> {
                    var updated = new ServiceItem(existing.id(), existing.salonId(), name, description,
                            price, currency, durationMinutes, category, active, staffList,
                            existing.createdAt());
                    return repository.save(updated);
                });
    }

    void remove(UUID salonId, Long serviceId) {
        log.info("[SalonServiceManager] Removing service id={} from salon={}", serviceId, salonId);
        repository.findById(serviceId)
                .filter(s -> s.salonId().equals(salonId))
                .ifPresent(s -> repository.deleteById(serviceId));
    }
}
