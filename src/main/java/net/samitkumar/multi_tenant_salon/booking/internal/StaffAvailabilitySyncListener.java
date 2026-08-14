package net.samitkumar.multi_tenant_salon.booking.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailability;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonOperatingHoursUpdatedEvent;
import net.samitkumar.multi_tenant_salon.staff.StaffApi;
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
 * Keeps staff availability in sync with salon operating hours.
 *
 * When salon hours are updated:
 * - Newly open day   → add availability (clamped to salon window) for staff who don't have one yet
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
    void onOperatingHoursUpdated(SalonOperatingHoursUpdatedEvent event) {
        log.info("[StaffAvailabilitySyncListener] Received SalonOperatingHoursUpdatedEvent for salon={}", event.salonId());

        var activeStaff = staffApi.findAvailableForBookingBySalonId(event.salonId());
        if (activeStaff.isEmpty()) {
            log.info("[StaffAvailabilitySyncListener] No active staff for salon={} — skipping sync", event.salonId());
            return;
        }
        log.info("[StaffAvailabilitySyncListener] Syncing availability for {} staff member(s) in salon={}", activeStaff.size(), event.salonId());

        for (Salon.OperatingHours oh : event.operatingHours()) {
            if (oh.closed()) {
                log.info("[StaffAvailabilitySyncListener] {} is CLOSED — removing availability for all staff", oh.day());
                for (var member : activeStaff) {
                    availabilityRepo.deleteBySalonIdAndStaffIdAndDayOfWeek(
                            event.salonId(), member.id(), oh.day());
                }
            } else {
                LocalTime salonOpen  = LocalTime.parse(oh.openTime(),  TIME_FMT);
                LocalTime salonClose = LocalTime.parse(oh.closeTime(), TIME_FMT);
                log.info("[StaffAvailabilitySyncListener] {} is OPEN {}–{} — syncing staff windows", oh.day(), salonOpen, salonClose);

                List<StaffAvailability> toSave = new ArrayList<>();
                for (var member : activeStaff) {
                    var existing = availabilityRepo.findBySalonIdAndStaffIdAndDayOfWeek(
                            event.salonId(), member.id(), oh.day());

                    if (existing.isEmpty()) {
                        log.debug("[StaffAvailabilitySyncListener] staff={} has no record for {} — seeding from salon hours", member.id(), oh.day());
                        toSave.add(new StaffAvailability(
                                null, event.salonId(), member.id(),
                                oh.day(), salonOpen, salonClose, true));
                    } else {
                        var avail = existing.get();
                        LocalTime start = avail.startTime().isBefore(salonOpen)  ? salonOpen  : avail.startTime();
                        LocalTime end   = avail.endTime().isAfter(salonClose)    ? salonClose : avail.endTime();
                        if (!start.isBefore(end)) {
                            log.info("[StaffAvailabilitySyncListener] staff={} {} clamped window is empty — removing record", member.id(), oh.day());
                            availabilityRepo.deleteBySalonIdAndStaffIdAndDayOfWeek(
                                    event.salonId(), member.id(), oh.day());
                        } else if (!start.equals(avail.startTime()) || !end.equals(avail.endTime())) {
                            log.info("[StaffAvailabilitySyncListener] staff={} {} clamped {}–{} → {}–{}", member.id(), oh.day(), avail.startTime(), avail.endTime(), start, end);
                            availabilityRepo.deleteBySalonIdAndStaffIdAndDayOfWeek(
                                    event.salonId(), member.id(), oh.day());
                            toSave.add(new StaffAvailability(
                                    null, event.salonId(), member.id(),
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
        log.info("[StaffAvailabilitySyncListener] Sync complete for salon={}", event.salonId());
    }
}
