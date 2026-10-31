package net.samitkumar.multi_tenant_salon.superadmin.internal;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.UUID;

/** Read-only view of Spring Modulith's event publication tables ({@code event_publication} + archive). */
@RestController
@RequestMapping("/api/salon-super-admin/events")
class EventPublicationController {
    private final EventPublicationService events;
    EventPublicationController(EventPublicationService events) { this.events = events; }

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
}
