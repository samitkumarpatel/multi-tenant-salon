package net.samitkumar.multi_tenant_salon.staff.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.salon.SalonCreatedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@Slf4j
class OwnerStaffListener {

    private final StaffService staffService;

    OwnerStaffListener(StaffService staffService) {
        this.staffService = staffService;
    }

    @ApplicationModuleListener
    void onSalonCreated(SalonCreatedEvent event) {
        var member = staffService.onboardOwner(
                event.salonId(), event.ownerName(), event.ownerEmail(), event.ownerPhone());
        log.info("[STAFF] Owner '{}' auto-enrolled as staff (id: {}) for salon '{}'",
                member.name(), member.id(), event.salonName());
    }
}
