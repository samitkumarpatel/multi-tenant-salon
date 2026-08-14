package net.samitkumar.multi_tenant_salon.booking.internal;

import net.samitkumar.multi_tenant_salon.booking.StaffAvailability;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.staff.StaffOnboardedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Component
class StaffOnboardedListener {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("H:mm");

    private final StaffAvailabilityRepository availabilityRepo;
    private final SalonApi salonApi;

    StaffOnboardedListener(StaffAvailabilityRepository availabilityRepo, SalonApi salonApi) {
        this.availabilityRepo = availabilityRepo;
        this.salonApi = salonApi;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void onStaffOnboarded(StaffOnboardedEvent event) {
        log.info("[StaffOnboardedListener] Received StaffOnboardedEvent for salon={} staff={} schedule={} entries", event.salonId(), event.staffId(), event.schedule().size());
        if (event.schedule().isEmpty()) return;

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
