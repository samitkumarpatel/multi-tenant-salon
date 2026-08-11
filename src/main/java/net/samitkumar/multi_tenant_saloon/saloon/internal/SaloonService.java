package net.samitkumar.multi_tenant_saloon.saloon.internal;

import net.samitkumar.multi_tenant_saloon.saloon.Saloon;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonApi;
import net.samitkumar.multi_tenant_saloon.utility.CountryApi;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonClosure;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonCreatedEvent;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonDisabledEvent;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonFeature;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonHoliday;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonOperatingHoursUpdatedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
class SaloonService implements SaloonApi {

    private final SaloonRepository repository;
    private final SaloonClosureRepository closureRepository;
    private final SaloonHolidayRepository holidayRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final CountryApi countryApi;

    SaloonService(SaloonRepository repository, SaloonClosureRepository closureRepository,
                  SaloonHolidayRepository holidayRepository,
                  ApplicationEventPublisher eventPublisher, CountryApi countryApi) {
        this.repository = repository;
        this.closureRepository = closureRepository;
        this.holidayRepository = holidayRepository;
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
                saloon.bookingRequiresConfirmation(), label, saloon.createdAt(), saloon.status());
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
        log.info("[SaloonService] Creating saloon name='{}' owner='{}'", name, owner.email());
        var handler = deriveUniqueHandler(name);
        var featureRefs = features != null
                ? features.stream().map(Saloon.SaloonFeatureRef::new).toList()
                : List.<Saloon.SaloonFeatureRef>of();
        var saloon = new Saloon(null, name, handler, owner, location, contact, operatingHours, featureRefs, 60,
                businessRegistrationId, showBusinessId, false, deriveBusinessIdLabel(location), Instant.now(), Saloon.SaloonStatus.ACTIVE);
        var saved = repository.save(saloon);
        log.info("[SaloonService] Saloon created id={} handler='{}'", saved.id(), saved.handler());
        var eventFeatures = saved.features().stream().map(Saloon.SaloonFeatureRef::feature).toList();
        eventPublisher.publishEvent(new SaloonCreatedEvent(saved.id(), saved.name(), saved.owner().name(), saved.owner().email(), saved.owner().phone(), eventFeatures));
        return saved;
    }

    @Override
    public List<Saloon> findAll() {
        return repository.findAll().stream().map(this::withLabel).toList();
    }

    @Override
    public Optional<Saloon> findById(UUID id) {
        return repository.findById(id).map(this::withLabel);
    }

    @Override
    public List<Saloon> search(String q, Saloon.SaloonStatus status) {
        boolean hasQuery = q != null && !q.isBlank();
        List<Saloon> results;
        if (hasQuery && status != null) {
            results = repository.searchByTextAndStatus(q.trim(), status.name());
        } else if (hasQuery) {
            results = repository.searchByText(q.trim());
        } else if (status != null) {
            results = repository.findByStatus(status);
        } else {
            results = repository.findAll();
        }
        return results.stream().map(this::withLabel).toList();
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

    @Transactional
    Optional<Saloon> update(UUID id, String name, Saloon.Location location, Saloon.ContactInfo contact,
                            List<Saloon.OperatingHours> operatingHours, Integer bookingAdvanceDays,
                            String businessRegistrationId, Boolean showBusinessId, Boolean bookingRequiresConfirmation) {
        log.info("[SaloonService] Updating saloon id={}", id);
        return repository.findById(id).map(existing -> {
            var nameToSave = (name != null && !name.isBlank()) ? name : existing.name();
            var days = bookingAdvanceDays != null ? bookingAdvanceDays : existing.bookingAdvanceDays();
            var bizId    = businessRegistrationId != null ? businessRegistrationId : existing.businessRegistrationId();
            var showBiz  = showBusinessId != null ? showBusinessId : existing.showBusinessId();
            var needsConfirm = bookingRequiresConfirmation != null ? bookingRequiresConfirmation : existing.bookingRequiresConfirmation();
            var bizLabel = location != null ? deriveBusinessIdLabel(location) : existing.businessIdLabel();
            var updated = new Saloon(existing.id(), nameToSave, existing.handler(), existing.owner(), location, contact,
                    operatingHours, existing.features(), days, bizId, showBiz, needsConfirm, bizLabel, existing.createdAt(), existing.status());
            var saved = repository.save(updated);
            if (operatingHours != null && !operatingHours.isEmpty()) {
                log.info("[SaloonService] Publishing SaloonOperatingHoursUpdatedEvent for saloon={} days={}", saved.id(), operatingHours.size());
                eventPublisher.publishEvent(new SaloonOperatingHoursUpdatedEvent(saved.id(), operatingHours));
            }
            return saved;
        });
    }

    @Override
    public Optional<Saloon> updateOwner(UUID id, Saloon.Owner owner) {
        log.info("[SaloonService] Updating owner for saloon id={}", id);
        return repository.findById(id).map(existing -> {
            var updated = new Saloon(existing.id(), existing.name(), existing.handler(), owner,
                    existing.location(), existing.contact(), existing.operatingHours(), existing.features(),
                    existing.bookingAdvanceDays(), existing.businessRegistrationId(), existing.showBusinessId(),
                    existing.bookingRequiresConfirmation(), existing.businessIdLabel(), existing.createdAt(), existing.status());
            return repository.save(updated);
        });
    }

    public Optional<Saloon> updateFeatures(UUID id, List<SaloonFeature> features) {
        log.info("[SaloonService] Updating features for saloon id={} features={}", id, features);
        return repository.findById(id).map(existing -> {
            var featureRefs = features != null
                    ? features.stream().map(Saloon.SaloonFeatureRef::new).toList()
                    : List.<Saloon.SaloonFeatureRef>of();
            var updated = new Saloon(existing.id(), existing.name(), existing.handler(), existing.owner(),
                    existing.location(), existing.contact(), existing.operatingHours(), featureRefs,
                    existing.bookingAdvanceDays(), existing.businessRegistrationId(), existing.showBusinessId(),
                    existing.bookingRequiresConfirmation(), existing.businessIdLabel(), existing.createdAt(), existing.status());
            return repository.save(updated);
        });
    }

    Optional<Saloon> updateBookingSettings(UUID id, Integer bookingAdvanceDays, Boolean bookingRequiresConfirmation) {
        log.info("[SaloonService] Updating booking settings for saloon id={}", id);
        return repository.findById(id).map(existing -> {
            var days = bookingAdvanceDays != null ? bookingAdvanceDays : existing.bookingAdvanceDays();
            var confirm = bookingRequiresConfirmation != null ? bookingRequiresConfirmation : existing.bookingRequiresConfirmation();
            var updated = new Saloon(existing.id(), existing.name(), existing.handler(), existing.owner(),
                    existing.location(), existing.contact(), existing.operatingHours(), existing.features(),
                    days, existing.businessRegistrationId(), existing.showBusinessId(),
                    confirm, existing.businessIdLabel(), existing.createdAt(), existing.status());
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
        // 1. Explicit one-off closure date ranges
        if (!closureRepository
                .findBySaloonIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(saloonId, date, date)
                .isEmpty()) {
            return true;
        }
        // 2. Named holidays (recurring or year-specific)
        if (!holidayRepository.findMatchingHolidays(
                saloonId, date.getMonthValue(), date.getDayOfMonth(), date.getYear()).isEmpty()) {
            return true;
        }
        // 3. Regular weekly operating hours
        var hours = repository.findById(saloonId)
                .map(s -> s.operatingHours() != null ? s.operatingHours() : List.<Saloon.OperatingHours>of())
                .orElse(List.of());
        if (hours.isEmpty()) return false;
        DayOfWeek dow = date.getDayOfWeek();
        return hours.stream()
                .filter(h -> h.day() == dow)
                .findFirst()
                .map(Saloon.OperatingHours::closed)
                .orElse(false);
    }

    @Override
    public List<SaloonHoliday> findHolidays(UUID saloonId) {
        return holidayRepository.findBySaloonId(saloonId);
    }

    @Override
    public boolean bookingRequiresConfirmation(UUID saloonId) {
        return repository.findById(saloonId)
                .map(Saloon::bookingRequiresConfirmation)
                .orElse(false);
    }

    SaloonHoliday addHoliday(UUID saloonId, String name, int month, int day, Integer endMonth, Integer endDay, Integer year) {
        log.info("[SaloonService] Adding holiday '{}' for saloon id={} date={}/{}", name, saloonId, month, day);
        var saved = holidayRepository.save(new SaloonHoliday(null, saloonId, name, month, day, endMonth, endDay, year, Instant.now()));
        int currentYear = LocalDate.now().getYear();
        int em = endMonth != null ? endMonth : month;
        int ed = endDay   != null ? endDay   : day;
        if (year != null) {
            createHolidayClosure(saloonId, name, month, day, em, ed, year, saved.id());
        } else {
            for (int y = currentYear; y <= currentYear + 4; y++) {
                createHolidayClosure(saloonId, name, month, day, em, ed, y, saved.id());
            }
        }
        return saved;
    }

    private void createHolidayClosure(UUID saloonId, String name, int startMonth, int startDay, int endMonth, int endDay, int year, Long holidayId) {
        try {
            var startDate = LocalDate.of(year, startMonth, startDay);
            // If end is earlier in the year than start, the range crosses a year boundary (e.g. Dec 24 – Jan 2)
            var endDate = (endMonth < startMonth || (endMonth == startMonth && endDay < startDay))
                    ? LocalDate.of(year + 1, endMonth, endDay)
                    : LocalDate.of(year, endMonth, endDay);
            closureRepository.save(new SaloonClosure(null, saloonId, startDate, endDate, name, holidayId));
        } catch (DateTimeException ignored) {
            // Skip invalid dates such as Feb 29 in a non-leap year
        }
    }

    void removeHoliday(UUID saloonId, Long holidayId) {
        log.info("[SaloonService] Removing holiday id={} from saloon id={}", holidayId, saloonId);
        holidayRepository.findById(holidayId)
                .filter(h -> h.saloonId().equals(saloonId))
                .ifPresent(h -> holidayRepository.deleteById(holidayId));
        // Linked closures are deleted automatically via ON DELETE CASCADE in the DB
    }

    @Override
    public List<SaloonClosure> findClosures(UUID saloonId) {
        return closureRepository.findBySaloonId(saloonId);
    }

    SaloonClosure addClosure(UUID saloonId, LocalDate startDate, LocalDate endDate, String reason) {
        log.info("[SaloonService] Adding closure for saloon id={} from={} to='{}'", saloonId, startDate, endDate);
        return closureRepository.save(new SaloonClosure(null, saloonId, startDate, endDate, reason, null));
    }

    boolean removeClosure(UUID saloonId, Long closureId) {
        log.info("[SaloonService] Removing closure id={} from saloon id={}", closureId, saloonId);
        var closure = closureRepository.findById(closureId)
                .filter(c -> c.saloonId().equals(saloonId));
        if (closure.isEmpty()) return true;
        if (closure.get().holidayId() != null) return false;
        closureRepository.deleteById(closureId);
        return true;
    }

    @Override
    public Optional<Saloon> disable(UUID id) {
        log.info("[SaloonService] Disabling saloon id={}", id);
        return repository.findById(id).map(existing -> {
            var updated = new Saloon(existing.id(), existing.name(), existing.handler(), existing.owner(),
                    existing.location(), existing.contact(), existing.operatingHours(), existing.features(),
                    existing.bookingAdvanceDays(), existing.businessRegistrationId(), existing.showBusinessId(),
                    existing.bookingRequiresConfirmation(), existing.businessIdLabel(), existing.createdAt(), Saloon.SaloonStatus.DISABLED);
            var saved = repository.save(updated);
            eventPublisher.publishEvent(new SaloonDisabledEvent(saved.id(), saved.name(), saved.owner().name(), saved.owner().email()));
            return saved;
        });
    }

    @Override
    public Optional<Saloon> enable(UUID id) {
        log.info("[SaloonService] Enabling saloon id={}", id);
        return repository.findById(id).map(existing -> {
            var updated = new Saloon(existing.id(), existing.name(), existing.handler(), existing.owner(),
                    existing.location(), existing.contact(), existing.operatingHours(), existing.features(),
                    existing.bookingAdvanceDays(), existing.businessRegistrationId(), existing.showBusinessId(),
                    existing.bookingRequiresConfirmation(), existing.businessIdLabel(), existing.createdAt(), Saloon.SaloonStatus.ACTIVE);
            return repository.save(updated);
        });
    }

}
