package net.samitkumar.multi_tenant_saloon.booking.internal;

import net.samitkumar.multi_tenant_saloon.booking.StaffAvailability;
import net.samitkumar.multi_tenant_saloon.staff.StaffOnboardedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
class StaffOnboardedListener {

    private final StaffAvailabilityRepository availabilityRepo;

    StaffOnboardedListener(StaffAvailabilityRepository availabilityRepo) {
        this.availabilityRepo = availabilityRepo;
    }

    @ApplicationModuleListener
    void onStaffOnboarded(StaffOnboardedEvent event) {
        var entries = event.schedule().stream()
                .map(d -> new StaffAvailability(null, event.saloonId(), event.staffId(),
                        d.dayOfWeek(), d.startTime(), d.endTime(), true))
                .toList();
        availabilityRepo.saveAll(entries);
    }
}
