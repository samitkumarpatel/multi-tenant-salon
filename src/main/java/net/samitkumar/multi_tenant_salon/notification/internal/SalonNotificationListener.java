package net.samitkumar.multi_tenant_salon.notification.internal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.salon.SalonCreatedEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonDisabledEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonUpdatedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
class SalonNotificationListener {

    private final NotificationService notificationService;

    @ApplicationModuleListener
    void onSalonCreated(SalonCreatedEvent event) {
        log.info("[NOTIFICATION] New salon registered — notifying owner {} <{}> for salon '{}' (id: {})",
                event.ownerName(), event.ownerEmail(), event.salonName(), event.salonId());
        notificationService.notifySalonOnboarded(event);
    }

    @ApplicationModuleListener
    void onSalonDisabled(SalonDisabledEvent event) {
        log.info("[NOTIFICATION] Salon disabled — notifying owner {} <{}> for salon '{}' (id: {})",
                event.ownerName(), event.ownerEmail(), event.salonName(), event.salonId());
        notificationService.notifySalonDisabled(event);
    }

    @ApplicationModuleListener
    void onSalonUpdated(SalonUpdatedEvent event) {
        log.info("[NOTIFICATION] Salon updated — notifying owner {} <{}> for salon '{}' (id: {})",
                event.ownerName(), event.ownerEmail(), event.salonName(), event.salonId());
        notificationService.notifySalonUpdated(event);
    }
}
