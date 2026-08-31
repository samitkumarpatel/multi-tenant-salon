package net.samitkumar.multi_tenant_salon.analytics.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

// Called anonymously from the public salon website (permitAll — see MultiTenantSalonApplication's
// security config), so this is the only line of defense against spam/misuse: batch size is capped
// and every event is dropped unless its salon exists and has actually opted into ANALYTICS.
@Slf4j
@RestController
@RequestMapping("/api/analytics")
class AnalyticsIngestController {

    private static final int MAX_BATCH_SIZE = 200;

    private final SalonApi salonApi;
    private final AnalyticsQueueGateway queueGateway;

    AnalyticsIngestController(SalonApi salonApi, AnalyticsQueueGateway queueGateway) {
        this.salonApi = salonApi;
        this.queueGateway = queueGateway;
    }

    record ActivityEventRequest(
            @NotNull UUID salonId,
            String sessionId,
            @NotNull AnalyticsEventType eventType,
            @NotBlank String path,
            String label,
            Instant occurredAt) {}

    @PostMapping("/events")
    ResponseEntity<Void> receive(@Valid @RequestBody List<ActivityEventRequest> events) {
        if (events == null || events.isEmpty()) {
            return ResponseEntity.accepted().build();
        }
        if (events.size() > MAX_BATCH_SIZE) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        events.forEach(this::enqueueIfEligible);
        return ResponseEntity.accepted().build();
    }

    private void enqueueIfEligible(ActivityEventRequest event) {
        salonApi.findById(event.salonId())
                .filter(AnalyticsIngestController::hasAnalyticsEnabled)
                .ifPresentOrElse(
                        salon -> queueGateway.send(new QueuedActivityEvent(
                                event.salonId(),
                                event.sessionId(),
                                event.eventType(),
                                event.path(),
                                event.label(),
                                event.occurredAt() != null ? event.occurredAt() : Instant.now())),
                        () -> log.debug("[Analytics] Dropping event for salon {} — not found or ANALYTICS not enabled", event.salonId()));
    }

    private static boolean hasAnalyticsEnabled(Salon salon) {
        return salon.features().stream().anyMatch(f -> f.feature() == SalonFeature.ANALYTICS);
    }
}
