package net.samitkumar.multi_tenant_saloon.saloon.internal;

import net.samitkumar.multi_tenant_saloon.saloon.Saloon;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonApi;
import net.samitkumar.multi_tenant_saloon.utility.CountryApi;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonClosure;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonCreatedEvent;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonFeature;
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
    private final CountryApi countryApi;

    SaloonService(SaloonRepository repository, SaloonClosureRepository closureRepository,
                  ApplicationEventPublisher eventPublisher, CountryApi countryApi) {
        this.repository = repository;
        this.closureRepository = closureRepository;
        this.eventPublisher = eventPublisher;
        this.countryApi = countryApi;
    }

    private String deriveBusinessIdLabel(Saloon.Location location) {
        if (location == null || location.country() == null) return null;
        return countryApi.findByName(location.country())
                .map(c -> c.businessIdLabel())
                .orElse(null);
    }

    private Saloon withLabel(Saloon saloon) {
        if (saloon.businessIdLabel() != null) return saloon;
        var label = deriveBusinessIdLabel(saloon.location());
        if (label == null) return saloon;
        return new Saloon(saloon.id(), saloon.name(), saloon.handler(), saloon.owner(),
                saloon.location(), saloon.contact(), saloon.operatingHours(), saloon.features(),
                saloon.bookingAdvanceDays(), saloon.businessRegistrationId(), saloon.showBusinessId(),
                label, saloon.createdAt(), saloon.status());
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
                  List<Saloon.OperatingHours> operatingHours, List<SaloonFeature> features,
                  String businessRegistrationId, Boolean showBusinessId) {
        var handler = deriveUniqueHandler(name);
        var featureRefs = features != null
                ? features.stream().map(Saloon.SaloonFeatureRef::new).toList()
                : List.<Saloon.SaloonFeatureRef>of();
        var saloon = new Saloon(null, name, handler, owner, location, contact, operatingHours, featureRefs, 60,
                businessRegistrationId, showBusinessId, deriveBusinessIdLabel(location), Instant.now(), Saloon.SaloonStatus.ACTIVE);
        var saved = repository.save(saloon);
        var eventFeatures = saved.features().stream().map(Saloon.SaloonFeatureRef::feature).toList();
        eventPublisher.publishEvent(new SaloonCreatedEvent(saved.id(), saved.name(), saved.owner().name(), saved.owner().email(), saved.owner().phone(), eventFeatures));
        return saved;
    }

    List<Saloon> findAll() {
        return repository.findAll().stream().map(this::withLabel).toList();
    }

    List<Saloon> findByOwnerEmail(String email) {
        return repository.findByOwnerEmail(email).stream().map(this::withLabel).toList();
    }

    Optional<Saloon> findByIdOrHandler(String id) {
        try {
            return repository.findById(UUID.fromString(id)).map(this::withLabel);
        } catch (IllegalArgumentException e) {
            return repository.findByHandler(id).map(this::withLabel);
        }
    }

    Optional<Saloon> update(UUID id, String name, Saloon.Location location, Saloon.ContactInfo contact,
                            List<Saloon.OperatingHours> operatingHours, Integer bookingAdvanceDays,
                            String businessRegistrationId, Boolean showBusinessId) {
        return repository.findById(id).map(existing -> {
            var nameToSave = (name != null && !name.isBlank()) ? name : existing.name();
            var days = bookingAdvanceDays != null ? bookingAdvanceDays : existing.bookingAdvanceDays();
            var bizId    = businessRegistrationId != null ? businessRegistrationId : existing.businessRegistrationId();
            var showBiz  = showBusinessId != null ? showBusinessId : existing.showBusinessId();
            var bizLabel = location != null ? deriveBusinessIdLabel(location) : existing.businessIdLabel();
            var updated = new Saloon(existing.id(), nameToSave, existing.handler(), existing.owner(), location, contact,
                    operatingHours, existing.features(), days, bizId, showBiz, bizLabel, existing.createdAt(), existing.status());
            return repository.save(updated);
        });
    }

    Optional<Saloon> updateFeatures(UUID id, List<SaloonFeature> features) {
        return repository.findById(id).map(existing -> {
            var featureRefs = features != null
                    ? features.stream().map(Saloon.SaloonFeatureRef::new).toList()
                    : List.<Saloon.SaloonFeatureRef>of();
            var updated = new Saloon(existing.id(), existing.name(), existing.handler(), existing.owner(),
                    existing.location(), existing.contact(), existing.operatingHours(), featureRefs,
                    existing.bookingAdvanceDays(), existing.businessRegistrationId(), existing.showBusinessId(),
                    existing.businessIdLabel(), existing.createdAt(), existing.status());
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

    Optional<Saloon> disable(UUID id) {
        return repository.findById(id).map(existing -> {
            var updated = new Saloon(existing.id(), existing.name(), existing.handler(), existing.owner(),
                    existing.location(), existing.contact(), existing.operatingHours(), existing.features(),
                    existing.bookingAdvanceDays(), existing.businessRegistrationId(), existing.showBusinessId(),
                    existing.businessIdLabel(), existing.createdAt(), Saloon.SaloonStatus.DISABLED);
            return repository.save(updated);
        });
    }

    Optional<Saloon> enable(UUID id) {
        return repository.findById(id).map(existing -> {
            var updated = new Saloon(existing.id(), existing.name(), existing.handler(), existing.owner(),
                    existing.location(), existing.contact(), existing.operatingHours(), existing.features(),
                    existing.bookingAdvanceDays(), existing.businessRegistrationId(), existing.showBusinessId(),
                    existing.businessIdLabel(), existing.createdAt(), Saloon.SaloonStatus.ACTIVE);
            return repository.save(updated);
        });
    }

}
