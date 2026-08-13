package net.samitkumar.multi_tenant_saloon.staff.internal;

import net.samitkumar.multi_tenant_saloon.media.MediaService;
import net.samitkumar.multi_tenant_saloon.staff.StaffMember;
import net.samitkumar.multi_tenant_saloon.staff.StaffOnboardedEvent;
import net.samitkumar.multi_tenant_saloon.staff.StaffRole;
import net.samitkumar.multi_tenant_saloon.staff.StaffStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
class StaffController {

    private final StaffService service;
    private final MediaService mediaApi;

    StaffController(StaffService service, Optional<MediaService> mediaApi) {
        this.service = service;
        this.mediaApi = mediaApi.orElse(null);
    }

    record OnboardRequest(String name, String email, String phone, StaffRole role,
                          List<String> specializations,
                          List<StaffOnboardedEvent.DaySchedule> schedule) {}

    record UpdateRequest(String name, String email, String phone, StaffRole role, StaffStatus status,
                         Boolean availableForBooking, List<String> specializations, String photoUrl) {}

    record PhotoUploadRequest(String contentType) {}

    @GetMapping({"/api/saloon/{saloonId}/staff", "/api/saloon-admin/{saloonId}/staff"})
    List<StaffMember> findAll(@PathVariable UUID saloonId) {
        return service.findBySaloonId(saloonId);
    }

    @PostMapping("/api/saloon-admin/{saloonId}/staff")
    ResponseEntity<StaffMember> onboard(@PathVariable UUID saloonId, @RequestBody OnboardRequest request) {
        var member = service.onboard(saloonId, request.name(), request.email(), request.phone(),
                request.role(), false, request.specializations(), request.schedule());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(member.id())
                .toUri();
        return ResponseEntity.created(location).body(member);
    }

    @GetMapping({"/api/saloon/{saloonId}/staff/{staffId}", "/api/saloon-admin/{saloonId}/staff/{staffId}"})
    ResponseEntity<StaffMember> findById(@PathVariable UUID saloonId, @PathVariable Long staffId) {
        return service.findByIdAndSaloonId(staffId, saloonId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/saloon-admin/{saloonId}/staff/{staffId}")
    ResponseEntity<StaffMember> update(@PathVariable UUID saloonId, @PathVariable Long staffId,
                                       @RequestBody UpdateRequest request) {
        return service.update(saloonId, staffId, request.name(), request.email(), request.phone(),
                        request.role(), request.status(),
                        request.availableForBooking() == null || request.availableForBooking(),
                        request.specializations(), request.photoUrl())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/saloon-admin/{saloonId}/staff/{staffId}")
    ResponseEntity<Void> remove(@PathVariable UUID saloonId, @PathVariable Long staffId) {
        service.remove(saloonId, staffId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/saloon-admin/{saloonId}/staff/{staffId}/photo-upload-url")
    ResponseEntity<MediaService.PresignedUpload> getPhotoUploadUrl(@PathVariable UUID saloonId,
                                                                   @PathVariable Long staffId,
                                                                   @RequestBody PhotoUploadRequest request) {
        if (mediaApi == null) return ResponseEntity.status(503).build();
        return service.findByIdAndSaloonId(staffId, saloonId)
                .map(m -> ResponseEntity.ok(mediaApi.generateStaffPhotoUploadUrl(staffId, request.contentType())))
                .orElse(ResponseEntity.notFound().build());
    }
}
