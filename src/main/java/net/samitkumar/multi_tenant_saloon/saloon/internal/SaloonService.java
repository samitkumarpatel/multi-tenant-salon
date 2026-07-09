package net.samitkumar.multi_tenant_saloon.saloon.internal;

import net.samitkumar.multi_tenant_saloon.saloon.Saloon;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonCreatedEvent;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonFeature;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
class SaloonService {

    private final SaloonRepository repository;
    private final ApplicationEventPublisher eventPublisher;

    SaloonService(SaloonRepository repository, ApplicationEventPublisher eventPublisher) {
        this.repository = repository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    Saloon create(String name, Saloon.Owner owner, Saloon.Location location, Saloon.ContactInfo contact,
                  List<Saloon.OperatingHours> operatingHours, List<SaloonFeature> features) {
        var handler = name.toLowerCase().replaceAll("\\s+", "-").replaceAll("[^a-z0-9-]", "");
        var featureRefs = features != null
                ? features.stream().map(Saloon.SaloonFeatureRef::new).toList()
                : List.<Saloon.SaloonFeatureRef>of();
        var saloon = new Saloon(null, name, handler, owner, location, contact, operatingHours, featureRefs, Instant.now());
        var saved = repository.save(saloon);
        var eventFeatures = saved.features().stream().map(Saloon.SaloonFeatureRef::feature).toList();
        eventPublisher.publishEvent(new SaloonCreatedEvent(saved.id(), saved.name(), saved.owner().name(), saved.owner().email(), eventFeatures));
        return saved;
    }

    List<Saloon> findAll() {
        return repository.findAll();
    }

    Optional<Saloon> findById(UUID id) {
        return repository.findById(id);
    }

    Optional<Saloon> findByHandler(String handler) {
        return repository.findByHandler(handler);
    }

    Optional<Saloon> update(UUID id, String name, Saloon.Location location, Saloon.ContactInfo contact,
                            List<Saloon.OperatingHours> operatingHours) {
        return repository.findById(id).map(existing -> {
            var updated = new Saloon(existing.id(), name, existing.handler(), existing.owner(), location, contact,
                    operatingHours, existing.features(), existing.createdAt());
            return repository.save(updated);
        });
    }

    Optional<Saloon> updateFeatures(UUID id, List<SaloonFeature> features) {
        return repository.findById(id).map(existing -> {
            var featureRefs = features != null
                    ? features.stream().map(Saloon.SaloonFeatureRef::new).toList()
                    : List.<Saloon.SaloonFeatureRef>of();
            var updated = new Saloon(existing.id(), existing.name(), existing.handler(), existing.owner(),
                    existing.location(), existing.contact(), existing.operatingHours(), featureRefs, existing.createdAt());
            return repository.save(updated);
        });
    }

    void delete(UUID id) {
        repository.deleteById(id);
    }
}
