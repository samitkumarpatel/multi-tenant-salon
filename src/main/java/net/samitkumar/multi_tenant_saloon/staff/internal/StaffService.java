package net.samitkumar.multi_tenant_saloon.staff.internal;

import net.samitkumar.multi_tenant_saloon.staff.StaffApi;
import net.samitkumar.multi_tenant_saloon.staff.StaffMember;
import net.samitkumar.multi_tenant_saloon.staff.StaffOnboardedEvent;
import net.samitkumar.multi_tenant_saloon.staff.StaffRole;
import net.samitkumar.multi_tenant_saloon.staff.StaffStatus;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class StaffService implements StaffApi {

    private static final LocalTime DEFAULT_START = LocalTime.of(9, 0);
    private static final LocalTime DEFAULT_END   = LocalTime.of(18, 0);
    private static final List<DayOfWeek> DEFAULT_DAYS =
            List.of(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
                    DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY);

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

    StaffMember onboard(UUID saloonId, String name, String email, String phone, StaffRole role,
                        List<String> specializations, List<StaffOnboardedEvent.DaySchedule> schedule) {
        var specs = specializations != null
                ? specializations.stream().map(StaffMember.Specialization::new).toList()
                : List.<StaffMember.Specialization>of();
        var member = new StaffMember(null, saloonId, name, email, phone, role, StaffStatus.ACTIVE,
                false, true, specs, Instant.now());
        var saved = repository.save(member);
        var effectiveSchedule = (schedule != null && !schedule.isEmpty())
                ? schedule
                : DEFAULT_DAYS.stream()
                        .map(d -> new StaffOnboardedEvent.DaySchedule(d, DEFAULT_START, DEFAULT_END))
                        .toList();
        eventPublisher.publishEvent(new StaffOnboardedEvent(saloonId, saved.id(), effectiveSchedule));
        return saved;
    }

    StaffMember onboardOwner(UUID saloonId, String name, String email, String phone) {
        var member = new StaffMember(null, saloonId, name, email, phone, StaffRole.MANAGER, StaffStatus.ACTIVE,
                true, true, List.of(), Instant.now());
        return repository.save(member);
    }

    Optional<StaffMember> update(UUID saloonId, Long staffId, String name, String email, String phone,
                                 StaffRole role, StaffStatus status, boolean availableForBooking,
                                 List<String> specializations) {
        var specs = specializations != null
                ? specializations.stream().map(StaffMember.Specialization::new).toList()
                : List.<StaffMember.Specialization>of();
        return repository.findById(staffId)
                .filter(m -> m.saloonId().equals(saloonId))
                .map(existing -> {
                    var updated = new StaffMember(existing.id(), existing.saloonId(), name, email, phone,
                            role, status, existing.isOwner(), availableForBooking, specs, existing.createdAt());
                    return repository.save(updated);
                });
    }

    void remove(UUID saloonId, Long staffId) {
        repository.findById(staffId)
                .filter(m -> m.saloonId().equals(saloonId))
                .ifPresent(m -> repository.deleteById(staffId));
    }
}
