package net.samitkumar.multi_tenant_salon.staff.internal;

import net.samitkumar.multi_tenant_salon.media.MediaService;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.staff.StaffMember;
import net.samitkumar.multi_tenant_salon.staff.StaffOnboardedEvent;
import net.samitkumar.multi_tenant_salon.staff.StaffRole;
import net.samitkumar.multi_tenant_salon.staff.StaffStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;
import java.util.Optional;

@RestController
class StaffController {

    private final StaffService service;
    private final MediaService mediaApi;
    private final SalonApi salonApi;

    StaffController(StaffService service, Optional<MediaService> mediaApi, SalonApi salonApi) {
        this.service = service;
        this.mediaApi = mediaApi.orElse(null);
        this.salonApi = salonApi;
    }

    record OnboardRequest(String name, String email, String phone, StaffRole role,
                          List<String> specializations, String bio, List<String> photoUrls,
                          List<StaffOnboardedEvent.DaySchedule> schedule) {}

    record UpdateRequest(String name, String email, String phone, StaffRole role, StaffStatus status,
                         Boolean availableForBooking, List<String> specializations, String photoUrl,
                         String bio, List<String> photoUrls) {}

    record PhotoUploadRequest(String contentType) {}

    @GetMapping({"/api/salon/{salonId}/staff", "/api/salon-admin/{salonId}/staff"})
    List<StaffMember> findAll(@PathVariable String salonId) {
        return service.findBySalonId(salonApi.resolveId(salonId));
    }

    @PostMapping("/api/salon-admin/{salonId}/staff")
    ResponseEntity<StaffMember> onboard(@PathVariable String salonId, @RequestBody OnboardRequest request) {
        var member = service.onboard(salonApi.resolveId(salonId), request.name(), request.email(), request.phone(),
                request.role(), false, request.specializations(), request.bio(), request.photoUrls(),
                request.schedule());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(member.id())
                .toUri();
        return ResponseEntity.created(location).body(member);
    }

    @GetMapping({"/api/salon/{salonId}/staff/{staffId}", "/api/salon-admin/{salonId}/staff/{staffId}"})
    ResponseEntity<StaffMember> findById(@PathVariable String salonId, @PathVariable Long staffId) {
        return service.findByIdAndSalonId(staffId, salonApi.resolveId(salonId))
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/salon-admin/{salonId}/staff/{staffId}")
    ResponseEntity<StaffMember> update(@PathVariable String salonId, @PathVariable Long staffId,
                                       @RequestBody UpdateRequest request) {
        return service.update(salonApi.resolveId(salonId), staffId, request.name(), request.email(), request.phone(),
                        request.role(), request.status(),
                        request.availableForBooking() == null || request.availableForBooking(),
                        request.specializations(), request.photoUrl(), request.bio(), request.photoUrls())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/salon-admin/{salonId}/staff/{staffId}")
    ResponseEntity<Void> remove(@PathVariable String salonId, @PathVariable Long staffId) {
        service.remove(salonApi.resolveId(salonId), staffId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/salon-admin/{salonId}/staff/{staffId}/photo-upload-url")
    ResponseEntity<MediaService.PresignedUpload> getPhotoUploadUrl(@PathVariable String salonId,
                                                                   @PathVariable Long staffId,
                                                                   @RequestBody PhotoUploadRequest request) {
        if (mediaApi == null) return ResponseEntity.status(503).build();
        return service.findByIdAndSalonId(staffId, salonApi.resolveId(salonId))
                .map(m -> ResponseEntity.ok(mediaApi.generateStaffPhotoUploadUrl(staffId, request.contentType())))
                .orElse(ResponseEntity.notFound().build());
    }
}
