package net.samitkumar.multi_tenant_salon.salonservice.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.salon.SalonCreatedEvent;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceCategory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Slf4j
class DefaultServicesSeeder {

    private final SalonServiceManager serviceManager;

    DefaultServicesSeeder(SalonServiceManager serviceManager) {
        this.serviceManager = serviceManager;
    }

    @ApplicationModuleListener
    void onSalonCreated(SalonCreatedEvent event) {
        serviceManager.add(event.salonId(), "Pay as you go", "Haircut, Coloring, Facial and more", null, null, null, ServiceCategory.OTHER, List.of());
        log.info("[SERVICE] Seeded default pay-as-you-go service for salon '{}'", event.salonName());
    }
}
