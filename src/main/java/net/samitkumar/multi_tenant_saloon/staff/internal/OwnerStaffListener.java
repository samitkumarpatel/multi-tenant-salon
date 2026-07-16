package net.samitkumar.multi_tenant_saloon.staff.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonCreatedEvent;
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
    void onSaloonCreated(SaloonCreatedEvent event) {
        var member = staffService.onboardOwner(
                event.saloonId(), event.ownerName(), event.ownerEmail(), event.ownerPhone());
        log.info("[STAFF] Owner '{}' auto-enrolled as staff (id: {}) for saloon '{}'",
                member.name(), member.id(), event.saloonName());
    }
}
