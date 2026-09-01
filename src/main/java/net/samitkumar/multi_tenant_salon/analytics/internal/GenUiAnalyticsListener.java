package net.samitkumar.multi_tenant_salon.analytics.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.chat.GenUiInteractionEvent;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

// Mirrors AnalyticsIngestController's eligibility check: only recorded for a salon that both
// exists and has opted into ANALYTICS. Unlike page-view/click ingestion (anonymous, high-volume,
// so it goes through the Azure queue), the chat module already runs this server-side and trusted,
// so the event is recorded directly - no queue hop needed.
@Slf4j
@Component
class GenUiAnalyticsListener {

    private final SalonApi salonApi;
    private final GenUiEventRepository repository;

    GenUiAnalyticsListener(SalonApi salonApi, GenUiEventRepository repository) {
        this.salonApi = salonApi;
        this.repository = repository;
    }

    @ApplicationModuleListener
    void onGenUiInteraction(GenUiInteractionEvent event) {
        try {
            var salonId = salonApi.resolveId(event.salonId());
            salonApi.findById(salonId)
                    .filter(GenUiAnalyticsListener::hasAnalyticsEnabled)
                    .ifPresent(salon -> repository.save(new GenUiEvent(
                            null, salonId, event.sessionId(), event.type().name(), event.detail(), event.occurredAt())));
        } catch (Exception e) {
            log.debug("[Analytics] Dropping GenUI event for unresolvable salon {}: {}", event.salonId(), e.getMessage());
        }
    }

    private static boolean hasAnalyticsEnabled(Salon salon) {
        return salon.features().stream().anyMatch(f -> f.feature() == SalonFeature.ANALYTICS);
    }
}
