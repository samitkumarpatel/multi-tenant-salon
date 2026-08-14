package net.samitkumar.multi_tenant_salon.notification.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.salon.SalonCreatedEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonDisabledEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@Slf4j
class SalonNotificationListener {

    @ApplicationModuleListener
    void onSalonCreated(SalonCreatedEvent event) {
        log.info("""
                [NOTIFICATION] New salon registered — owner notification queued.
                  Salon  : {} (id: {})
                  Owner   : {} <{}>
                  Manage  : /salon/{}/manage
                  Features: {}
                """,
                event.salonName(), event.salonId(),
                event.ownerName(), event.ownerEmail(),
                event.salonId(),
                event.features().isEmpty() ? "none" : event.features());
    }

    @ApplicationModuleListener
    void onSalonDisabled(SalonDisabledEvent event) {
        log.info("""
                [NOTIFICATION] Salon disabled — owner notification queued.
                  Salon : {} (id: {})
                  Owner  : {} <{}>
                """,
                event.salonName(), event.salonId(),
                event.ownerName(), event.ownerEmail());
    }
}
