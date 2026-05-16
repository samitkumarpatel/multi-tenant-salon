package net.samitkumar.multi_tenant_saloon.notification.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonCreatedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@Slf4j
class SaloonNotificationListener {

    @ApplicationModuleListener
    void onSaloonCreated(SaloonCreatedEvent event) {
        log.info("""
                [NOTIFICATION] New saloon registered — owner notification queued.
                  Saloon  : {} (id: {})
                  Owner   : {} <{}>
                  Manage  : /saloon/{}/manage
                  Features: {}
                """,
                event.saloonName(), event.saloonId(),
                event.ownerName(), event.ownerEmail(),
                event.saloonId(),
                event.features().isEmpty() ? "none" : event.features());
    }
}
