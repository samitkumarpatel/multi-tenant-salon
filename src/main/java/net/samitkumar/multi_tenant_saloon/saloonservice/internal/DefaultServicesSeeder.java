package net.samitkumar.multi_tenant_saloon.saloonservice.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonCreatedEvent;
import net.samitkumar.multi_tenant_saloon.saloonservice.ServiceCategory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Slf4j
class DefaultServicesSeeder {

    private final SaloonServiceManager serviceManager;

    DefaultServicesSeeder(SaloonServiceManager serviceManager) {
        this.serviceManager = serviceManager;
    }

    @ApplicationModuleListener
    void onSaloonCreated(SaloonCreatedEvent event) {
        serviceManager.add(event.saloonId(), "Pay as you go", "Haircut, Coloring, Facial and more", null, null, null, ServiceCategory.OTHER, List.of());
        log.info("[SERVICE] Seeded default pay-as-you-go service for saloon '{}'", event.saloonName());
    }
}
