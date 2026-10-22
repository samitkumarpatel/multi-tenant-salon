package net.samitkumar.multi_tenant_salon.booking.internal;

import org.springframework.modulith.events.ApplicationModuleListener;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailability;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.staff.StaffOnboardedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Component
class StaffOnboardedListener {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("H:mm");

    private final StaffAvailabilityRepository availabilityRepo;
    private final SalonApi salonApi;
    private final StaffScheduleLock scheduleLock;

    StaffOnboardedListener(StaffAvailabilityRepository availabilityRepo, SalonApi salonApi, StaffScheduleLock scheduleLock) {
        this.availabilityRepo = availabilityRepo;
        this.salonApi = salonApi;
        this.scheduleLock = scheduleLock;
    }

    /** Delivered (and retried on failure) by Spring Modulith from {@code event_publication}. */
    @ApplicationModuleListener
    void onStaffOnboarded(StaffOnboardedEvent event) {
        log.info("[StaffOnboardedListener] Received StaffOnboardedEvent for salon={} staff={} schedule={} entries", event.salonId(), event.staffId(), event.schedule().size());
        if (event.schedule().isEmpty()) return;
        // Serialized with an owner saving this stylist's hours; a redelivery, or hours the owner already
        // set, must not be seeded over.
        scheduleLock.lock(event.staffId());
        if (!availabilityRepo.findBySalonIdAndStaffId(event.salonId(), event.staffId()).isEmpty()) {
            log.info("[StaffOnboardedListener] staff={} already has availability — nothing to seed", event.staffId());
            return;
        }

        List<Salon.OperatingHours> operatingHours = salonApi.findOperatingHours(event.salonId());

        var entries = event.schedule().stream()
                .flatMap(d -> {
                    if (operatingHours.isEmpty()) {
                        // No salon hours configured — keep the requested schedule as-is
                        return java.util.stream.Stream.of(
                                new StaffAvailability(null, event.salonId(), event.staffId(),
                                        d.dayOfWeek(), d.startTime(), d.endTime(), true));
                    }

                    return operatingHours.stream()
                            .filter(oh -> oh.day() == d.dayOfWeek() && !oh.closed())
                            .findFirst()
                            .flatMap(oh -> {
                                LocalTime salonOpen  = LocalTime.parse(oh.openTime(),  TIME_FMT);
                                LocalTime salonClose = LocalTime.parse(oh.closeTime(), TIME_FMT);
                                LocalTime start = d.startTime().isBefore(salonOpen)  ? salonOpen  : d.startTime();
                                LocalTime end   = d.endTime().isAfter(salonClose)    ? salonClose : d.endTime();
                                if (!start.isBefore(end)) return java.util.Optional.empty();
                                return java.util.Optional.of(
                                        new StaffAvailability(null, event.salonId(), event.staffId(),
                                                d.dayOfWeek(), start, end, true));
                            })
                            .stream();
                })
                .toList();

        availabilityRepo.saveAll(entries);
        log.info("[StaffOnboardedListener] Saved {} availability entries for staff={} salon={}", entries.size(), event.staffId(), event.salonId());
    }
}
