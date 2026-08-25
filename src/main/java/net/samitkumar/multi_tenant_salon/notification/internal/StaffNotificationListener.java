package net.samitkumar.multi_tenant_salon.notification.internal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.staff.StaffOnboardedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
class StaffNotificationListener {

    private final NotificationService notificationService;

    @ApplicationModuleListener
    void onStaffOnboarded(StaffOnboardedEvent event) {
        log.info("[NOTIFICATION → STAFF] New staff member {} <{}> onboarded to salon {} — sending welcome email",
                event.staffName(), event.staffEmail(), event.salonId());
        notificationService.notifyStaffOnboarded(event);
    }
}
