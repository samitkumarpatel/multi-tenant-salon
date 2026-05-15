package net.samitkumar.multi_tenant_saloon.saloon.internal;

import net.samitkumar.multi_tenant_saloon.saloon.Saloon;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonCreatedEvent;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonFeature;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
class SaloonService {

    private final SaloonRepository repository;
    private final ApplicationEventPublisher eventPublisher;

    SaloonService(SaloonRepository repository, ApplicationEventPublisher eventPublisher) {
        this.repository = repository;
        this.eventPublisher = eventPublisher;
    }

    Saloon create(String name, Saloon.Owner owner, Saloon.Location location, Saloon.ContactInfo contact,
                  List<Saloon.OperatingHours> operatingHours, List<SaloonFeature> features) {
        var saloon = new Saloon(null, name, owner, location, contact, operatingHours, features, Instant.now());
        var saved = repository.save(saloon);
        eventPublisher.publishEvent(new SaloonCreatedEvent(saved.id(), saved.name(), saved.features()));
        return saved;
    }

    List<Saloon> findAll() {
        return repository.findAll();
    }

    Optional<Saloon> findById(String id) {
        return repository.findById(id);
    }

    Optional<Saloon> update(String id, String name, Saloon.Location location, Saloon.ContactInfo contact,
                            List<Saloon.OperatingHours> operatingHours) {
        return repository.findById(id).map(existing -> {
            var updated = new Saloon(existing.id(), name, existing.owner(), location, contact,
                    operatingHours, existing.features(), existing.createdAt());
            return repository.save(updated);
        });
    }

    Optional<Saloon> updateFeatures(String id, List<SaloonFeature> features) {
        return repository.findById(id).map(existing -> {
            var updated = new Saloon(existing.id(), existing.name(), existing.owner(), existing.location(),
                    existing.contact(), existing.operatingHours(), features, existing.createdAt());
            return repository.save(updated);
        });
    }

    void delete(String id) {
        repository.deleteById(id);
    }
}
