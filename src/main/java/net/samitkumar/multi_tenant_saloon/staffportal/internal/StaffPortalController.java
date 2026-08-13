package net.samitkumar.multi_tenant_saloon.staffportal.internal;

import net.samitkumar.multi_tenant_saloon.booking.Booking;
import net.samitkumar.multi_tenant_saloon.booking.BookingApi;
import net.samitkumar.multi_tenant_saloon.booking.StaffAvailabilityOverride;
import net.samitkumar.multi_tenant_saloon.media.MediaService;
import net.samitkumar.multi_tenant_saloon.staff.StaffApi;
import net.samitkumar.multi_tenant_saloon.staff.StaffMember;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/saloon-staff")
class StaffPortalController {

    private final StaffApi staffApi;
    private final BookingApi bookingApi;
    private final MediaService mediaApi;

    StaffPortalController(StaffApi staffApi, BookingApi bookingApi, Optional<MediaService> mediaApi) {
        this.staffApi = staffApi;
        this.bookingApi = bookingApi;
        this.mediaApi = mediaApi.orElse(null);
    }

    record ProfileUpdateRequest(String name, String phone, List<String> specializations, Boolean availableForBooking, String photoUrl) {}

    record PhotoUploadRequest(String contentType) {}

    record HolidayRequest(LocalDate overrideDate, String reason) {}

    @GetMapping("/me")
    ResponseEntity<List<StaffMember>> findByEmail(@RequestParam String email) {
        var members = staffApi.findByEmail(email);
        if (members.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(members);
    }

    @GetMapping("/{staffId}")
    ResponseEntity<StaffMember> findById(@PathVariable Long staffId) {
        return staffApi.findById(staffId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PatchMapping("/{staffId}/profile")
    ResponseEntity<StaffMember> updateProfile(@PathVariable Long staffId,
                                              @RequestBody ProfileUpdateRequest request) {
        return staffApi.findById(staffId).map(existing -> {
            String name  = request.name()  != null ? request.name()  : existing.name();
            String phone = request.phone() != null ? request.phone() : existing.phone();
            return staffApi.updateProfile(staffId, name, phone, request.specializations(), request.availableForBooking(), request.photoUrl())
                    .map(ResponseEntity::ok)
                    .orElse(ResponseEntity.notFound().build());
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{staffId}/photo-upload-url")
    ResponseEntity<MediaService.PresignedUpload> getPhotoUploadUrl(@PathVariable Long staffId,
                                                                   @RequestBody PhotoUploadRequest request) {
        if (mediaApi == null) return ResponseEntity.status(503).build();
        return staffApi.findById(staffId)
                .map(m -> ResponseEntity.ok(mediaApi.generateStaffPhotoUploadUrl(staffId, request.contentType())))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{staffId}/appointments")
    ResponseEntity<List<Booking>> getAppointments(@PathVariable Long staffId) {
        return staffApi.findById(staffId).map(member ->
                ResponseEntity.ok(bookingApi.findByStaff(member.saloonId(), staffId))
        ).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{staffId}/holidays")
    ResponseEntity<List<StaffAvailabilityOverride>> getHolidays(@PathVariable Long staffId) {
        return staffApi.findById(staffId).map(member ->
                ResponseEntity.ok(
                        bookingApi.getOverrides(member.saloonId(), staffId).stream()
                                .filter(o -> !o.available())
                                .toList()
                )
        ).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{staffId}/holidays")
    ResponseEntity<StaffAvailabilityOverride> addHoliday(@PathVariable Long staffId,
                                                          @RequestBody HolidayRequest request) {
        return staffApi.findById(staffId).map(member -> {
            var override = new StaffAvailabilityOverride(
                    null, member.saloonId(), staffId,
                    request.overrideDate(), null, null,
                    false, request.reason()
            );
            var saved = bookingApi.addOverride(member.saloonId(), staffId, override);
            var location = ServletUriComponentsBuilder.fromCurrentRequest()
                    .path("/{id}")
                    .buildAndExpand(saved.id())
                    .toUri();
            return ResponseEntity.created(location).body(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{staffId}/holidays/{holidayId}")
    ResponseEntity<Void> removeHoliday(@PathVariable Long staffId, @PathVariable Long holidayId) {
        var member = staffApi.findById(staffId);
        if (member.isEmpty()) return ResponseEntity.notFound().build();
        bookingApi.removeOverride(member.get().saloonId(), staffId, holidayId);
        return ResponseEntity.noContent().build();
    }
}
