package net.samitkumar.multi_tenant_salon.staff.internal;

import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.staff.StaffApi;
import net.samitkumar.multi_tenant_salon.staff.StaffMember;
import net.samitkumar.multi_tenant_salon.staff.StaffOnboardedEvent;
import net.samitkumar.multi_tenant_salon.staff.StaffRole;
import net.samitkumar.multi_tenant_salon.staff.StaffStatus;
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
    private final SalonApi salonApi;
    private final ApplicationEventPublisher eventPublisher;

    StaffService(StaffRepository repository, SalonApi salonApi, ApplicationEventPublisher eventPublisher) {
        this.repository = repository;
        this.salonApi = salonApi;
        this.eventPublisher = eventPublisher;
    }

    @Override
    public List<StaffMember> findBySalonId(UUID salonId) {
        return repository.findBySalonId(salonId);
    }

    @Override
    public Optional<StaffMember> findByIdAndSalonId(Long staffId, UUID salonId) {
        return repository.findById(staffId).filter(m -> m.salonId().equals(salonId));
    }

    @Override
    public List<StaffMember> findAvailableForBookingBySalonId(UUID salonId) {
        return repository.findBySalonIdAndAvailableForBookingTrue(salonId);
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
                                               String avatarUrl, String bio, List<String> workMedia) {
        return repository.findById(staffId).map(existing -> {
            var specs = (specializations != null)
                    ? specializations.stream().map(StaffMember.Specialization::new).toList()
                    : existing.specializations();
            boolean bookable = (availableForBooking != null) ? availableForBooking : existing.availableForBooking();
            String avatar = avatarUrl != null ? avatarUrl : existing.avatarUrl();
            String about = bio != null ? bio : existing.bio();
            var media = workMedia != null ? toWorkMedia(workMedia) : existing.workMedia();
            var updated = new StaffMember(
                    existing.id(), existing.salonId(), name, existing.email(), phone,
                    existing.role(), existing.status(), existing.isOwner(),
                    bookable, avatar, about, specs, media, existing.createdAt());
            return repository.save(updated);
        });
    }

    private static List<StaffMember.WorkMedia> toWorkMedia(List<String> urls) {
        return urls != null
                ? urls.stream().map(StaffMember.WorkMedia::new).toList()
                : List.of();
    }

    @Transactional
    StaffMember onboard(UUID salonId, String name, String email, String phone, StaffRole role,
                        boolean isOwner, List<String> specializations,
                        String bio, List<String> workMedia,
                        List<StaffOnboardedEvent.DaySchedule> schedule) {
        log.info("[StaffService] Onboarding staff '{}' ({}) role={} salon={}", name, email, role, salonId);
        var specs = specializations != null
                ? specializations.stream().map(StaffMember.Specialization::new).toList()
                : List.<StaffMember.Specialization>of();
        var member = new StaffMember(null, salonId, name, email, phone, role, StaffStatus.ACTIVE,
                isOwner, true, null, bio, specs, toWorkMedia(workMedia), Instant.now());
        var saved = repository.save(member);
        log.info("[StaffService] Staff onboarded id={} salon={}", saved.id(), salonId);
        var effectiveSchedule = (schedule != null && !schedule.isEmpty())
                ? schedule
                : DEFAULT_SCHEDULE;
        var salon = salonApi.findById(salonId);
        eventPublisher.publishEvent(new StaffOnboardedEvent(
                salonId, saved.id(), saved.name(), saved.email(), saved.role(),
                salon.map(Salon::name).orElse(null),
                salon.map(Salon::handler).orElse(null),
                effectiveSchedule));
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

    StaffMember onboardOwner(UUID salonId, String name, String email, String phone) {
        return onboard(salonId, name, email, phone, StaffRole.MANAGER, true, List.of(), null, List.of(), null);
    }

    Optional<StaffMember> update(UUID salonId, Long staffId, String name, String email, String phone,
                                 StaffRole role, StaffStatus status, boolean availableForBooking,
                                 List<String> specializations, String avatarUrl,
                                 String bio, List<String> workMedia) {
        log.info("[StaffService] Updating staff id={} salon={} role={} status={}", staffId, salonId, role, status);
        var specs = specializations != null
                ? specializations.stream().map(StaffMember.Specialization::new).toList()
                : List.<StaffMember.Specialization>of();
        return repository.findById(staffId)
                .filter(m -> m.salonId().equals(salonId))
                .map(existing -> {
                    String avatar = avatarUrl != null ? avatarUrl : existing.avatarUrl();
                    var media = workMedia != null ? toWorkMedia(workMedia) : existing.workMedia();
                    var updated = new StaffMember(existing.id(), existing.salonId(), name, email, phone,
                            role, status, existing.isOwner(), availableForBooking, avatar, bio, specs, media,
                            existing.createdAt());
                    return repository.save(updated);
                });
    }

    void remove(UUID salonId, Long staffId) {
        log.info("[StaffService] Removing staff id={} from salon={}", staffId, salonId);
        repository.findById(staffId)
                .filter(m -> m.salonId().equals(salonId))
                .ifPresent(m -> repository.deleteById(staffId));
    }
}
