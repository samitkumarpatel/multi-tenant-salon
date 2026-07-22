package net.samitkumar.multi_tenant_saloon.saloon.internal;

import net.samitkumar.multi_tenant_saloon.saloon.Saloon;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonApi;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonClosure;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonCreatedEvent;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonFeature;
import net.samitkumar.multi_tenant_saloon.saloon.WebsitePublishRequestedEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
class SaloonService implements SaloonApi {

    private final SaloonRepository repository;
    private final SaloonClosureRepository closureRepository;
    private final ApplicationEventPublisher eventPublisher;

    SaloonService(SaloonRepository repository, SaloonClosureRepository closureRepository, ApplicationEventPublisher eventPublisher) {
        this.repository = repository;
        this.closureRepository = closureRepository;
        this.eventPublisher = eventPublisher;
    }

    private String deriveUniqueHandler(String name) {
        var base = name.toLowerCase().replaceAll("\\s+", "-").replaceAll("[^a-z0-9-]", "");
        if (!repository.existsByHandler(base)) {
            return base;
        }
        int suffix = 2;
        while (repository.existsByHandler(base + "-" + suffix)) {
            suffix++;
        }
        return base + "-" + suffix;
    }

    @Transactional
    Saloon create(String name, Saloon.Owner owner, Saloon.Location location, Saloon.ContactInfo contact,
                  List<Saloon.OperatingHours> operatingHours, List<SaloonFeature> features) {
        var handler = deriveUniqueHandler(name);
        var featureRefs = features != null
                ? features.stream().map(Saloon.SaloonFeatureRef::new).toList()
                : List.<Saloon.SaloonFeatureRef>of();
        var saloon = new Saloon(null, name, handler, owner, location, contact, operatingHours, featureRefs, 60, Instant.now());
        var saved = repository.save(saloon);
        var eventFeatures = saved.features().stream().map(Saloon.SaloonFeatureRef::feature).toList();
        eventPublisher.publishEvent(new SaloonCreatedEvent(saved.id(), saved.name(), saved.owner().name(), saved.owner().email(), saved.owner().phone(), eventFeatures));
        return saved;
    }

    List<Saloon> findAll() {
        return repository.findAll();
    }

    Optional<Saloon> findByIdOrHandler(String id) {
        try {
            return repository.findById(UUID.fromString(id));
        } catch (IllegalArgumentException e) {
            return repository.findByHandler(id);
        }
    }

    Optional<Saloon> update(UUID id, String name, Saloon.Location location, Saloon.ContactInfo contact,
                            List<Saloon.OperatingHours> operatingHours, Integer bookingAdvanceDays) {
        return repository.findById(id).map(existing -> {
            var days = bookingAdvanceDays != null ? bookingAdvanceDays : existing.bookingAdvanceDays();
            var updated = new Saloon(existing.id(), name, existing.handler(), existing.owner(), location, contact,
                    operatingHours, existing.features(), days, existing.createdAt());
            return repository.save(updated);
        });
    }

    Optional<Saloon> updateFeatures(UUID id, List<SaloonFeature> features) {
        return repository.findById(id).map(existing -> {
            var featureRefs = features != null
                    ? features.stream().map(Saloon.SaloonFeatureRef::new).toList()
                    : List.<Saloon.SaloonFeatureRef>of();
            var updated = new Saloon(existing.id(), existing.name(), existing.handler(), existing.owner(),
                    existing.location(), existing.contact(), existing.operatingHours(), featureRefs, existing.bookingAdvanceDays(), existing.createdAt());
            return repository.save(updated);
        });
    }

    @Override
    public List<Saloon.OperatingHours> findOperatingHours(UUID saloonId) {
        return repository.findById(saloonId)
                .map(s -> s.operatingHours() != null ? s.operatingHours() : List.<Saloon.OperatingHours>of())
                .orElse(List.of());
    }

    @Override
    public boolean isClosedOn(UUID saloonId, LocalDate date) {
        return !closureRepository
                .findBySaloonIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(saloonId, date, date)
                .isEmpty();
    }

    @Override
    public List<SaloonClosure> findClosures(UUID saloonId) {
        return closureRepository.findBySaloonId(saloonId);
    }

    SaloonClosure addClosure(UUID saloonId, LocalDate startDate, LocalDate endDate, String reason) {
        return closureRepository.save(new SaloonClosure(null, saloonId, startDate, endDate, reason));
    }

    void removeClosure(UUID saloonId, Long closureId) {
        closureRepository.findById(closureId)
                .filter(c -> c.saloonId().equals(saloonId))
                .ifPresent(c -> closureRepository.deleteById(closureId));
    }

    void delete(UUID id) {
        repository.deleteById(id);
    }

    enum PublishWebsiteResult { OK, NOT_FOUND, FEATURE_NOT_ENABLED }

    @Transactional
    PublishWebsiteResult publishWebsite(UUID id) {
        var saloon = repository.findById(id).orElse(null);
        if (saloon == null) return PublishWebsiteResult.NOT_FOUND;

        boolean hasWebsiteFeature = saloon.features().stream()
                .anyMatch(ref -> ref.feature() == SaloonFeature.STATIC_WEBSITE);
        if (!hasWebsiteFeature) return PublishWebsiteResult.FEATURE_NOT_ENABLED;

        eventPublisher.publishEvent(
                new WebsitePublishRequestedEvent(saloon.id(), saloon.name(), saloon.handler(), saloon.owner().email()));
        return PublishWebsiteResult.OK;
    }
}
