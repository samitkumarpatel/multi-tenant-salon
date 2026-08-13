package net.samitkumar.multi_tenant_saloon.staff.internal;

import net.samitkumar.multi_tenant_saloon.staff.StaffApi;
import net.samitkumar.multi_tenant_saloon.staff.StaffMember;
import net.samitkumar.multi_tenant_saloon.staff.StaffOnboardedEvent;
import net.samitkumar.multi_tenant_saloon.staff.StaffRole;
import net.samitkumar.multi_tenant_saloon.staff.StaffStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
public class StaffService implements StaffApi {

    private final StaffRepository repository;
    private final ApplicationEventPublisher eventPublisher;

    StaffService(StaffRepository repository, ApplicationEventPublisher eventPublisher) {
        this.repository = repository;
        this.eventPublisher = eventPublisher;
    }

    @Override
    public List<StaffMember> findBySaloonId(UUID saloonId) {
        return repository.findBySaloonId(saloonId);
    }

    @Override
    public Optional<StaffMember> findByIdAndSaloonId(Long staffId, UUID saloonId) {
        return repository.findById(staffId).filter(m -> m.saloonId().equals(saloonId));
    }

    @Override
    public List<StaffMember> findAvailableForBookingBySaloonId(UUID saloonId) {
        return repository.findBySaloonIdAndAvailableForBookingTrue(saloonId);
    }

    @Override
    public List<StaffMember> findByEmail(String email) {
        return repository.findByEmail(email);
    }

    @Override
    public Optional<StaffMember> findById(Long staffId) {
        return repository.findById(staffId);
    }

    @Override
    public Optional<StaffMember> updateProfile(Long staffId, String name, String phone,
                                               List<String> specializations, Boolean availableForBooking,
                                               String photoUrl) {
        return repository.findById(staffId).map(existing -> {
            var specs = (specializations != null)
                    ? specializations.stream().map(StaffMember.Specialization::new).toList()
                    : existing.specializations();
            boolean bookable = (availableForBooking != null) ? availableForBooking : existing.availableForBooking();
            String photo = photoUrl != null ? photoUrl : existing.photoUrl();
            var updated = new StaffMember(
                    existing.id(), existing.saloonId(), name, existing.email(), phone,
                    existing.role(), existing.status(), existing.isOwner(),
                    bookable, photo, specs, existing.createdAt());
            return repository.save(updated);
        });
    }

    @Transactional
    StaffMember onboard(UUID saloonId, String name, String email, String phone, StaffRole role,
                        boolean isOwner, List<String> specializations,
                        List<StaffOnboardedEvent.DaySchedule> schedule) {
        log.info("[StaffService] Onboarding staff '{}' ({}) role={} saloon={}", name, email, role, saloonId);
        var specs = specializations != null
                ? specializations.stream().map(StaffMember.Specialization::new).toList()
                : List.<StaffMember.Specialization>of();
        var member = new StaffMember(null, saloonId, name, email, phone, role, StaffStatus.ACTIVE,
                isOwner, true, null, specs, Instant.now());
        var saved = repository.save(member);
        log.info("[StaffService] Staff onboarded id={} saloon={}", saved.id(), saloonId);
        var effectiveSchedule = (schedule != null && !schedule.isEmpty())
                ? schedule
                : DEFAULT_SCHEDULE;
        eventPublisher.publishEvent(new StaffOnboardedEvent(saloonId, saved.id(), effectiveSchedule));
        return saved;
    }

    private static final List<StaffOnboardedEvent.DaySchedule> DEFAULT_SCHEDULE = List.of(
            new StaffOnboardedEvent.DaySchedule(DayOfWeek.MONDAY,    LocalTime.of(9, 0), LocalTime.of(18, 0)),
            new StaffOnboardedEvent.DaySchedule(DayOfWeek.TUESDAY,   LocalTime.of(9, 0), LocalTime.of(18, 0)),
            new StaffOnboardedEvent.DaySchedule(DayOfWeek.WEDNESDAY, LocalTime.of(9, 0), LocalTime.of(18, 0)),
            new StaffOnboardedEvent.DaySchedule(DayOfWeek.THURSDAY,  LocalTime.of(9, 0), LocalTime.of(18, 0)),
            new StaffOnboardedEvent.DaySchedule(DayOfWeek.FRIDAY,    LocalTime.of(9, 0), LocalTime.of(18, 0)),
            new StaffOnboardedEvent.DaySchedule(DayOfWeek.SATURDAY,  LocalTime.of(9, 0), LocalTime.of(14, 0))
    );

    StaffMember onboardOwner(UUID saloonId, String name, String email, String phone) {
        return onboard(saloonId, name, email, phone, StaffRole.MANAGER, true, List.of(), null);
    }

    Optional<StaffMember> update(UUID saloonId, Long staffId, String name, String email, String phone,
                                 StaffRole role, StaffStatus status, boolean availableForBooking,
                                 List<String> specializations, String photoUrl) {
        log.info("[StaffService] Updating staff id={} saloon={} role={} status={}", staffId, saloonId, role, status);
        var specs = specializations != null
                ? specializations.stream().map(StaffMember.Specialization::new).toList()
                : List.<StaffMember.Specialization>of();
        return repository.findById(staffId)
                .filter(m -> m.saloonId().equals(saloonId))
                .map(existing -> {
                    String photo = photoUrl != null ? photoUrl : existing.photoUrl();
                    var updated = new StaffMember(existing.id(), existing.saloonId(), name, email, phone,
                            role, status, existing.isOwner(), availableForBooking, photo, specs, existing.createdAt());
                    return repository.save(updated);
                });
    }

    void remove(UUID saloonId, Long staffId) {
        log.info("[StaffService] Removing staff id={} from saloon={}", staffId, saloonId);
        repository.findById(staffId)
                .filter(m -> m.saloonId().equals(saloonId))
                .ifPresent(m -> repository.deleteById(staffId));
    }
}
