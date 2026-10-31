package net.samitkumar.multi_tenant_salon.superadmin.internal;

import org.springframework.http.HttpStatus;
import org.springframework.modulith.events.FailedEventPublications;
import org.springframework.modulith.events.ResubmissionOptions;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.UUID;

/** Read-only view of Spring Modulith's event publication tables ({@code event_publication} + archive). */
@RestController
@RequestMapping("/api/salon-super-admin/events")
class EventPublicationController {
    private final EventPublicationService events;
    private final FailedEventPublications failed;
    EventPublicationController(EventPublicationService events, FailedEventPublications failed) { this.events = events; this.failed = failed; }

    @GetMapping
    EventPublicationService.Page list(@RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "ALL") String status,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return events.list(q, status, page, size);
    }

    @GetMapping("/summary")
    List<EventPublicationService.StatusCount> summary() { return events.summary(); }

    @GetMapping("/{id}")
    EventPublicationService.Detail detail(@PathVariable UUID id) {
        return events.detail(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event publication not found"));
    }

    /**
     * Runs one failed delivery again now. Unlike the automatic retry it ignores the attempt and age limits, so it
     * is how a publication that gave up gets a new chance once its cause is fixed. The listener runs async,
     * exactly as on a normal delivery; a new failure is recorded the same way.
     */
    @PostMapping("/{id}/resubmit")
    @ResponseStatus(HttpStatus.ACCEPTED)
    void resubmit(@PathVariable UUID id) {
        if (events.detail(id).isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Event publication not found");
        if (!events.isFailed(id)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Only a failed publication can be resubmitted");
        // Modulith reads the oldest failed publications first and filters afterwards, so the batch must be big
        // enough to reach this one; a batch of 1 would only ever look at the oldest failure.
        failed.resubmit(ResubmissionOptions.defaults().withBatchSize(10_000)
                .withFilter(publication -> id.equals(publication.getIdentifier())));
    }
}
