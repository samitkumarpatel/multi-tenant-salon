package net.samitkumar.multi_tenant_salon.announcement.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.OffsetDateTime;
import java.util.List;

@RestController
class AnnouncementController {
    record Request(@NotBlank @Size(max = 140) String title, @NotBlank @Size(max = 2000) String message,
                   @Pattern(regexp = "INFO|WARNING|CRITICAL") String severity,
                   @Pattern(regexp = "SALON_OWNERS|ALL_APPS") String audience,
                   @Size(max = 500) @Pattern(regexp = "^$|https?://.+|/.*", message = "must be an http(s) URL or a path") String linkUrl,
                   @Size(max = 60) String linkLabel,
                   OffsetDateTime startsAt, OffsetDateTime endsAt, Boolean active) {}

    private final AnnouncementService announcements;
    AnnouncementController(AnnouncementService announcements) { this.announcements = announcements; }

    /** Anonymous on purpose: the notice must also reach the sign-in pages and salon-facing public apps. */
    @GetMapping("/api/public/announcements")
    ResponseEntity<List<AnnouncementService.PublicAnnouncement>> current(@RequestParam(defaultValue = "") String audience) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.maxAge(java.time.Duration.ofSeconds(30)).cachePublic())
                .body(announcements.current("SALON_OWNERS".equals(audience)));
    }

    @GetMapping("/api/salon-super-admin/announcements")
    List<AnnouncementService.Announcement> list() { return announcements.all(); }

    @PostMapping("/api/salon-super-admin/announcements")
    @ResponseStatus(HttpStatus.CREATED)
    AnnouncementService.Announcement create(@Valid @RequestBody Request request, Authentication auth) {
        return announcements.create(checked(request), auth == null ? null : auth.getName());
    }

    @PutMapping("/api/salon-super-admin/announcements/{id}")
    AnnouncementService.Announcement update(@PathVariable long id, @Valid @RequestBody Request request) {
        return announcements.update(id, checked(request)).orElseThrow(AnnouncementController::notFound);
    }

    @DeleteMapping("/api/salon-super-admin/announcements/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable long id) { if (!announcements.delete(id)) throw notFound(); }

    private static Request checked(Request r) {
        if (r.severity() == null || r.audience() == null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "severity and audience are required");
        if (r.startsAt() != null && r.endsAt() != null && !r.endsAt().isAfter(r.startsAt()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endsAt must be after startsAt");
        return r;
    }
    private static ResponseStatusException notFound() { return new ResponseStatusException(HttpStatus.NOT_FOUND, "Announcement not found"); }
}
