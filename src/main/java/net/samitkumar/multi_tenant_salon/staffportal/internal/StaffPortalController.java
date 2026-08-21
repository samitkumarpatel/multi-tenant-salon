package net.samitkumar.multi_tenant_salon.staffportal.internal;

import net.samitkumar.multi_tenant_salon.booking.Booking;
import net.samitkumar.multi_tenant_salon.booking.BookingApi;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverride;
import net.samitkumar.multi_tenant_salon.media.MediaService;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.staff.StaffApi;
import net.samitkumar.multi_tenant_salon.staff.StaffMember;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/salon-staff")
class StaffPortalController {

    private final StaffApi staffApi;
    private final BookingApi bookingApi;
    private final SalonApi salonApi;
    private final MediaService mediaApi;

    StaffPortalController(StaffApi staffApi, BookingApi bookingApi, SalonApi salonApi, Optional<MediaService> mediaApi) {
        this.staffApi = staffApi;
        this.bookingApi = bookingApi;
        this.salonApi = salonApi;
        this.mediaApi = mediaApi.orElse(null);
    }

    record ProfileUpdateRequest(String name, String phone, List<String> specializations, Boolean availableForBooking, String photoUrl) {}

    record PhotoUploadRequest(String contentType) {}

    record HolidayRequest(LocalDate overrideDate, String reason) {}

    record StaffMemberSummary(Long id, UUID salonId, String salonName, String salonHandler,
                              String name, String email, String phone, String role, String status,
                              boolean isOwner, boolean availableForBooking, String photoUrl,
                              List<String> specializations, Instant createdAt) {}

    @GetMapping("/me")
    ResponseEntity<List<StaffMemberSummary>> findByEmail(
            @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt,
            @RequestParam(required = false) String email) {
        // The caller's own identity always comes from the validated token, never
        // from client input — a request param would let anyone ask for anyone
        // else's staff record. The param stays only as a fallback for
        // unauthenticated (e.g. local mock-mode) callers.
        var callerEmail = jwt != null ? jwt.getSubject() : email;
        if (callerEmail == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        var members = staffApi.findByEmail(callerEmail);
        if (members.isEmpty()) return ResponseEntity.notFound().build();
        var result = members.stream()
                .map(m -> {
                    var salon = salonApi.findById(m.salonId());
                    return new StaffMemberSummary(
                            m.id(), m.salonId(),
                            salon.map(Salon::name).orElse(null),
                            salon.map(Salon::handler).orElse(null),
                            m.name(), m.email(), m.phone(),
                            m.role().name(), m.status().name(),
                            m.isOwner(), m.availableForBooking(), m.photoUrl(),
                            m.specializations().stream().map(StaffMember.Specialization::value).toList(),
                            m.createdAt()
                    );
                })
                .toList();
        return ResponseEntity.ok(result);
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
                ResponseEntity.ok(bookingApi.findByStaff(member.salonId(), staffId))
        ).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{staffId}/holidays")
    ResponseEntity<List<StaffAvailabilityOverride>> getHolidays(@PathVariable Long staffId) {
        return staffApi.findById(staffId).map(member ->
                ResponseEntity.ok(
                        bookingApi.getOverrides(member.salonId(), staffId).stream()
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
                    null, member.salonId(), staffId,
                    request.overrideDate(), null, null,
                    false, request.reason()
            );
            var saved = bookingApi.addOverride(member.salonId(), staffId, override);
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
        bookingApi.removeOverride(member.get().salonId(), staffId, holidayId);
        return ResponseEntity.noContent().build();
    }
}
