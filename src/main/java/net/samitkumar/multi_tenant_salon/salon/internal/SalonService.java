package net.samitkumar.multi_tenant_salon.salon.internal;

import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.utility.CountryApi;
import net.samitkumar.multi_tenant_salon.salon.SalonClosure;
import net.samitkumar.multi_tenant_salon.salon.SalonCreatedEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonDisabledEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.salon.SalonHoliday;
import net.samitkumar.multi_tenant_salon.salon.SalonOperatingHoursUpdatedEvent;
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
class SalonService implements SalonApi {

    private final SalonRepository repository;
    private final SalonClosureRepository closureRepository;
    private final SalonHolidayRepository holidayRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final CountryApi countryApi;

    SalonService(SalonRepository repository, SalonClosureRepository closureRepository,
                  SalonHolidayRepository holidayRepository,
                  ApplicationEventPublisher eventPublisher, CountryApi countryApi) {
        this.repository = repository;
        this.closureRepository = closureRepository;
        this.holidayRepository = holidayRepository;
        this.eventPublisher = eventPublisher;
        this.countryApi = countryApi;
    }

    private String deriveBusinessIdLabel(Salon.Location location) {
        if (location == null || location.country() == null) return null;
        return countryApi.findByName(location.country())
                .map(c -> c.businessIdLabel())
                .orElse(null);
    }

    private Salon withLabel(Salon salon) {
        if (salon.businessIdLabel() != null) return salon;
        var label = deriveBusinessIdLabel(salon.location());
        if (label == null) return salon;
        return new Salon(salon.id(), salon.name(), salon.handler(), salon.owner(),
                salon.location(), salon.contact(), salon.operatingHours(), salon.features(),
                salon.bookingAdvanceDays(), salon.businessRegistrationId(), salon.showBusinessId(),
                salon.bookingRequiresConfirmation(), label, salon.createdAt(), salon.status(),
                salon.termsAccepted(), salon.termsAcceptedAt());
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
    Salon create(String name, Salon.Owner owner, Salon.Location location, Salon.ContactInfo contact,
                  List<Salon.OperatingHours> operatingHours, List<SalonFeature> features,
                  String businessRegistrationId, Boolean showBusinessId, boolean termsAccepted) {
        log.info("[SalonService] Creating salon name='{}' owner='{}'", name, owner.email());
        var handler = deriveUniqueHandler(name);
        var featureRefs = features != null
                ? features.stream().map(Salon.SalonFeatureRef::new).toList()
                : List.<Salon.SalonFeatureRef>of();
        var now = Instant.now();
        var salon = new Salon(null, name, handler, owner, location, contact, operatingHours, featureRefs, 60,
                businessRegistrationId, showBusinessId, false, deriveBusinessIdLabel(location), now, Salon.SalonStatus.ACTIVE,
                termsAccepted, termsAccepted ? now : null);
        var saved = repository.save(salon);
        log.info("[SalonService] Salon created id={} handler='{}'", saved.id(), saved.handler());
        var eventFeatures = saved.features().stream().map(Salon.SalonFeatureRef::feature).toList();
        eventPublisher.publishEvent(new SalonCreatedEvent(saved.id(), saved.name(), saved.owner().name(), saved.owner().email(), saved.owner().phone(), eventFeatures));
        return saved;
    }

    @Override
    public List<Salon> findAll() {
        return repository.findAll().stream().map(this::withLabel).toList();
    }

    @Override
    public Optional<Salon> findById(UUID id) {
        return repository.findById(id).map(this::withLabel);
    }

    @Override
    public List<Salon> search(String q, Salon.SalonStatus status) {
        boolean hasQuery = q != null && !q.isBlank();
        List<Salon> results;
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

    List<Salon> findByOwnerEmail(String email) {
        return repository.findByOwnerEmail(email).stream().map(this::withLabel).toList();
    }

    Optional<Salon> findByIdOrHandler(String id) {
        try {
            return repository.findById(UUID.fromString(id)).map(this::withLabel);
        } catch (IllegalArgumentException e) {
            return repository.findByHandler(id).map(this::withLabel);
        }
    }

    @Transactional
    Optional<Salon> update(UUID id, String name, Salon.Location location, Salon.ContactInfo contact,
                            List<Salon.OperatingHours> operatingHours, Integer bookingAdvanceDays,
                            String businessRegistrationId, Boolean showBusinessId, Boolean bookingRequiresConfirmation) {
        log.info("[SalonService] Updating salon id={}", id);
        return repository.findById(id).map(existing -> {
            var nameToSave = (name != null && !name.isBlank()) ? name : existing.name();
            var days = bookingAdvanceDays != null ? bookingAdvanceDays : existing.bookingAdvanceDays();
            var bizId    = businessRegistrationId != null ? businessRegistrationId : existing.businessRegistrationId();
            var showBiz  = showBusinessId != null ? showBusinessId : existing.showBusinessId();
            var needsConfirm = bookingRequiresConfirmation != null ? bookingRequiresConfirmation : existing.bookingRequiresConfirmation();
            var bizLabel = location != null ? deriveBusinessIdLabel(location) : existing.businessIdLabel();
            var updated = new Salon(existing.id(), nameToSave, existing.handler(), existing.owner(), location, contact,
                    operatingHours, existing.features(), days, bizId, showBiz, needsConfirm, bizLabel, existing.createdAt(), existing.status(),
                    existing.termsAccepted(), existing.termsAcceptedAt());
            var saved = repository.save(updated);
            if (operatingHours != null && !operatingHours.isEmpty()) {
                log.info("[SalonService] Publishing SalonOperatingHoursUpdatedEvent for salon={} days={}", saved.id(), operatingHours.size());
                eventPublisher.publishEvent(new SalonOperatingHoursUpdatedEvent(saved.id(), operatingHours));
            }
            return saved;
        });
    }

    @Override
    public Optional<Salon> updateOwner(UUID id, Salon.Owner owner) {
        log.info("[SalonService] Updating owner for salon id={}", id);
        return repository.findById(id).map(existing -> {
            var updated = new Salon(existing.id(), existing.name(), existing.handler(), owner,
                    existing.location(), existing.contact(), existing.operatingHours(), existing.features(),
                    existing.bookingAdvanceDays(), existing.businessRegistrationId(), existing.showBusinessId(),
                    existing.bookingRequiresConfirmation(), existing.businessIdLabel(), existing.createdAt(), existing.status(),
                    existing.termsAccepted(), existing.termsAcceptedAt());
            return repository.save(updated);
        });
    }

    public Optional<Salon> updateFeatures(UUID id, List<SalonFeature> features) {
        log.info("[SalonService] Updating features for salon id={} features={}", id, features);
        return repository.findById(id).map(existing -> {
            var featureRefs = features != null
                    ? features.stream().map(Salon.SalonFeatureRef::new).toList()
                    : List.<Salon.SalonFeatureRef>of();
            var updated = new Salon(existing.id(), existing.name(), existing.handler(), existing.owner(),
                    existing.location(), existing.contact(), existing.operatingHours(), featureRefs,
                    existing.bookingAdvanceDays(), existing.businessRegistrationId(), existing.showBusinessId(),
                    existing.bookingRequiresConfirmation(), existing.businessIdLabel(), existing.createdAt(), existing.status(),
                    existing.termsAccepted(), existing.termsAcceptedAt());
            return repository.save(updated);
        });
    }

    Optional<Salon> updateBookingSettings(UUID id, Integer bookingAdvanceDays, Boolean bookingRequiresConfirmation) {
        log.info("[SalonService] Updating booking settings for salon id={}", id);
        return repository.findById(id).map(existing -> {
            var days = bookingAdvanceDays != null ? bookingAdvanceDays : existing.bookingAdvanceDays();
            var confirm = bookingRequiresConfirmation != null ? bookingRequiresConfirmation : existing.bookingRequiresConfirmation();
            var updated = new Salon(existing.id(), existing.name(), existing.handler(), existing.owner(),
                    existing.location(), existing.contact(), existing.operatingHours(), existing.features(),
                    days, existing.businessRegistrationId(), existing.showBusinessId(),
                    confirm, existing.businessIdLabel(), existing.createdAt(), existing.status(),
                    existing.termsAccepted(), existing.termsAcceptedAt());
            return repository.save(updated);
        });
    }

    @Override
    public List<Salon.OperatingHours> findOperatingHours(UUID salonId) {
        return repository.findById(salonId)
                .map(s -> s.operatingHours() != null ? s.operatingHours() : List.<Salon.OperatingHours>of())
                .orElse(List.of());
    }

    @Override
    public boolean isClosedOn(UUID salonId, LocalDate date) {
        // 1. Explicit one-off closure date ranges
        if (!closureRepository
                .findBySalonIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(salonId, date, date)
                .isEmpty()) {
            return true;
        }
        // 2. Named holidays (recurring or year-specific)
        if (!holidayRepository.findMatchingHolidays(
                salonId, date.getMonthValue(), date.getDayOfMonth(), date.getYear()).isEmpty()) {
            return true;
        }
        // 3. Regular weekly operating hours
        var hours = repository.findById(salonId)
                .map(s -> s.operatingHours() != null ? s.operatingHours() : List.<Salon.OperatingHours>of())
                .orElse(List.of());
        if (hours.isEmpty()) return false;
        DayOfWeek dow = date.getDayOfWeek();
        return hours.stream()
                .filter(h -> h.day() == dow)
                .findFirst()
                .map(Salon.OperatingHours::closed)
                .orElse(false);
    }

    @Override
    public List<SalonHoliday> findHolidays(UUID salonId) {
        return holidayRepository.findBySalonId(salonId);
    }

    @Override
    public boolean bookingRequiresConfirmation(UUID salonId) {
        return repository.findById(salonId)
                .map(Salon::bookingRequiresConfirmation)
                .orElse(false);
    }

    SalonHoliday addHoliday(UUID salonId, String name, int month, int day, Integer endMonth, Integer endDay, Integer year) {
        log.info("[SalonService] Adding holiday '{}' for salon id={} date={}/{}", name, salonId, month, day);
        var saved = holidayRepository.save(new SalonHoliday(null, salonId, name, month, day, endMonth, endDay, year, Instant.now()));
        int currentYear = LocalDate.now().getYear();
        int em = endMonth != null ? endMonth : month;
        int ed = endDay   != null ? endDay   : day;
        if (year != null) {
            createHolidayClosure(salonId, name, month, day, em, ed, year, saved.id());
        } else {
            for (int y = currentYear; y <= currentYear + 4; y++) {
                createHolidayClosure(salonId, name, month, day, em, ed, y, saved.id());
            }
        }
        return saved;
    }

    private void createHolidayClosure(UUID salonId, String name, int startMonth, int startDay, int endMonth, int endDay, int year, Long holidayId) {
        try {
            var startDate = LocalDate.of(year, startMonth, startDay);
            // If end is earlier in the year than start, the range crosses a year boundary (e.g. Dec 24 – Jan 2)
            var endDate = (endMonth < startMonth || (endMonth == startMonth && endDay < startDay))
                    ? LocalDate.of(year + 1, endMonth, endDay)
                    : LocalDate.of(year, endMonth, endDay);
            closureRepository.save(new SalonClosure(null, salonId, startDate, endDate, name, holidayId));
        } catch (DateTimeException ignored) {
            // Skip invalid dates such as Feb 29 in a non-leap year
        }
    }

    void removeHoliday(UUID salonId, Long holidayId) {
        log.info("[SalonService] Removing holiday id={} from salon id={}", holidayId, salonId);
        holidayRepository.findById(holidayId)
                .filter(h -> h.salonId().equals(salonId))
                .ifPresent(h -> holidayRepository.deleteById(holidayId));
        // Linked closures are deleted automatically via ON DELETE CASCADE in the DB
    }

    @Override
    public List<SalonClosure> findClosures(UUID salonId) {
        return closureRepository.findBySalonId(salonId);
    }

    SalonClosure addClosure(UUID salonId, LocalDate startDate, LocalDate endDate, String reason) {
        log.info("[SalonService] Adding closure for salon id={} from={} to='{}'", salonId, startDate, endDate);
        return closureRepository.save(new SalonClosure(null, salonId, startDate, endDate, reason, null));
    }

    boolean removeClosure(UUID salonId, Long closureId) {
        log.info("[SalonService] Removing closure id={} from salon id={}", closureId, salonId);
        var closure = closureRepository.findById(closureId)
                .filter(c -> c.salonId().equals(salonId));
        if (closure.isEmpty()) return true;
        if (closure.get().holidayId() != null) return false;
        closureRepository.deleteById(closureId);
        return true;
    }

    @Override
    public Optional<Salon> disable(UUID id) {
        log.info("[SalonService] Disabling salon id={}", id);
        return repository.findById(id).map(existing -> {
            var updated = new Salon(existing.id(), existing.name(), existing.handler(), existing.owner(),
                    existing.location(), existing.contact(), existing.operatingHours(), existing.features(),
                    existing.bookingAdvanceDays(), existing.businessRegistrationId(), existing.showBusinessId(),
                    existing.bookingRequiresConfirmation(), existing.businessIdLabel(), existing.createdAt(), Salon.SalonStatus.DISABLED,
                    existing.termsAccepted(), existing.termsAcceptedAt());
            var saved = repository.save(updated);
            eventPublisher.publishEvent(new SalonDisabledEvent(saved.id(), saved.name(), saved.owner().name(), saved.owner().email()));
            return saved;
        });
    }

    @Override
    public Optional<Salon> enable(UUID id) {
        log.info("[SalonService] Enabling salon id={}", id);
        return repository.findById(id).map(existing -> {
            var updated = new Salon(existing.id(), existing.name(), existing.handler(), existing.owner(),
                    existing.location(), existing.contact(), existing.operatingHours(), existing.features(),
                    existing.bookingAdvanceDays(), existing.businessRegistrationId(), existing.showBusinessId(),
                    existing.bookingRequiresConfirmation(), existing.businessIdLabel(), existing.createdAt(), Salon.SalonStatus.ACTIVE,
                    existing.termsAccepted(), existing.termsAcceptedAt());
            return repository.save(updated);
        });
    }

}
