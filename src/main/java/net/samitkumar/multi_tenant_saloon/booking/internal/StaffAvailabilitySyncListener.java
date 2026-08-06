package net.samitkumar.multi_tenant_saloon.booking.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_saloon.booking.StaffAvailability;
import net.samitkumar.multi_tenant_saloon.saloon.Saloon;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonOperatingHoursUpdatedEvent;
import net.samitkumar.multi_tenant_saloon.staff.StaffApi;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Keeps staff availability in sync with saloon operating hours.
 *
 * When saloon hours are updated:
 * - Newly open day   → add availability (clamped to saloon window) for staff who don't have one yet
 * - Existing open day with changed bounds → clamp each staff member's window to the new bounds
 * - Newly closed day → remove all staff availability for that day
 */
@Slf4j
@Component
class StaffAvailabilitySyncListener {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("H:mm");

    private final StaffAvailabilityRepository availabilityRepo;
    private final StaffApi staffApi;

    StaffAvailabilitySyncListener(StaffAvailabilityRepository availabilityRepo, StaffApi staffApi) {
        this.availabilityRepo = availabilityRepo;
        this.staffApi = staffApi;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    void onOperatingHoursUpdated(SaloonOperatingHoursUpdatedEvent event) {
        log.info("[StaffAvailabilitySyncListener] Received SaloonOperatingHoursUpdatedEvent for saloon={}", event.saloonId());

        var activeStaff = staffApi.findAvailableForBookingBySaloonId(event.saloonId());
        if (activeStaff.isEmpty()) {
            log.info("[StaffAvailabilitySyncListener] No active staff for saloon={} — skipping sync", event.saloonId());
            return;
        }
        log.info("[StaffAvailabilitySyncListener] Syncing availability for {} staff member(s) in saloon={}", activeStaff.size(), event.saloonId());

        for (Saloon.OperatingHours oh : event.operatingHours()) {
            if (oh.closed()) {
                log.info("[StaffAvailabilitySyncListener] {} is CLOSED — removing availability for all staff", oh.day());
                for (var member : activeStaff) {
                    availabilityRepo.deleteBySaloonIdAndStaffIdAndDayOfWeek(
                            event.saloonId(), member.id(), oh.day());
                }
            } else {
                LocalTime saloonOpen  = LocalTime.parse(oh.openTime(),  TIME_FMT);
                LocalTime saloonClose = LocalTime.parse(oh.closeTime(), TIME_FMT);
                log.info("[StaffAvailabilitySyncListener] {} is OPEN {}–{} — syncing staff windows", oh.day(), saloonOpen, saloonClose);

                List<StaffAvailability> toSave = new ArrayList<>();
                for (var member : activeStaff) {
                    var existing = availabilityRepo.findBySaloonIdAndStaffIdAndDayOfWeek(
                            event.saloonId(), member.id(), oh.day());

                    if (existing.isEmpty()) {
                        log.debug("[StaffAvailabilitySyncListener] staff={} has no record for {} — seeding from saloon hours", member.id(), oh.day());
                        toSave.add(new StaffAvailability(
                                null, event.saloonId(), member.id(),
                                oh.day(), saloonOpen, saloonClose, true));
                    } else {
                        var avail = existing.get();
                        LocalTime start = avail.startTime().isBefore(saloonOpen)  ? saloonOpen  : avail.startTime();
                        LocalTime end   = avail.endTime().isAfter(saloonClose)    ? saloonClose : avail.endTime();
                        if (!start.isBefore(end)) {
                            log.info("[StaffAvailabilitySyncListener] staff={} {} clamped window is empty — removing record", member.id(), oh.day());
                            availabilityRepo.deleteBySaloonIdAndStaffIdAndDayOfWeek(
                                    event.saloonId(), member.id(), oh.day());
                        } else if (!start.equals(avail.startTime()) || !end.equals(avail.endTime())) {
                            log.info("[StaffAvailabilitySyncListener] staff={} {} clamped {}–{} → {}–{}", member.id(), oh.day(), avail.startTime(), avail.endTime(), start, end);
                            availabilityRepo.deleteBySaloonIdAndStaffIdAndDayOfWeek(
                                    event.saloonId(), member.id(), oh.day());
                            toSave.add(new StaffAvailability(
                                    null, event.saloonId(), member.id(),
                                    oh.day(), start, end, true));
                        } else {
                            log.debug("[StaffAvailabilitySyncListener] staff={} {} already within bounds — no change", member.id(), oh.day());
                        }
                    }
                }
                if (!toSave.isEmpty()) {
                    availabilityRepo.saveAll(toSave);
                }
            }
        }
        log.info("[StaffAvailabilitySyncListener] Sync complete for saloon={}", event.saloonId());
    }
}
