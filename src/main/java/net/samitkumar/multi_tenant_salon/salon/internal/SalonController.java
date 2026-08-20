package net.samitkumar.multi_tenant_salon.salon.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonClosure;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.salon.SalonHoliday;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
class SalonController {

    private final SalonService service;

    SalonController(SalonService service) {
        this.service = service;
    }

    record CreateSalonRequest(
            @NotBlank String name,
            @NotBlank String ownerName,
            @NotBlank String ownerEmail,
            String ownerPhone,
            Salon.Location location,
            Salon.ContactInfo contact,
            List<Salon.OperatingHours> operatingHours,
            List<SalonFeature> features,
            String businessRegistrationId,
            Boolean showBusinessId,
            @AssertTrue(message = "You must accept the terms and conditions") boolean termsAccepted) {}

    record CreateSalonResponse(UUID salonId, String salonHandler, String emailId, String message) {}

    record UpdateSalonRequest(@NotBlank String name,
                               Salon.Location location,
                               Salon.ContactInfo contact,
                               List<Salon.OperatingHours> operatingHours,
                               Integer bookingAdvanceDays,
                               String businessRegistrationId,
                               Boolean showBusinessId,
                               Boolean bookingRequiresConfirmation) {}

    @PostMapping("/api/salon-onboarding")
    ResponseEntity<CreateSalonResponse> create(@Valid @RequestBody CreateSalonRequest request) {
        var owner = new Salon.Owner(request.ownerName(), request.ownerEmail(), request.ownerPhone());
        var salon = service.create(request.name(), owner, request.location(), request.contact(),
                request.operatingHours(), request.features(),
                request.businessRegistrationId(), request.showBusinessId(), request.termsAccepted());
        var location = ServletUriComponentsBuilder.fromCurrentRequest()
                .replacePath("/api/salon/{id}")
                .buildAndExpand(salon.id())
                .toUri();
        return ResponseEntity.created(location).body(new CreateSalonResponse(
                salon.id(),
                salon.handler(),
                owner.email(),
                "Welcome! We've sent a login link and setup guide to " + owner.email() + ". Use your email to sign in to the admin panel."
        ));
    }

    @GetMapping("/api/salon-onboarding")
    List<Salon> findAll() {
        return service.findAll();
    }

    @GetMapping("/api/salon-admin/my-salons")
    ResponseEntity<List<Salon>> findMysSalons(@RequestParam String email) {
        var salons = service.findByOwnerEmail(email);
        if (salons.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(salons);
    }

    @GetMapping({"/api/salon/{id}", "/api/salon-admin/{id}"})
    ResponseEntity<Salon> findByIdOrHandler(@PathVariable String id) {
        return service.findByIdOrHandler(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/salon-admin/{id}")
    ResponseEntity<Salon> update(@PathVariable UUID id, @Valid @RequestBody UpdateSalonRequest request) {
        return service.update(id, request.name(), request.location(), request.contact(), request.operatingHours(), request.bookingAdvanceDays(),
                        request.businessRegistrationId(), request.showBusinessId(), request.bookingRequiresConfirmation())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    record PatchBookingSettingsRequest(Integer bookingAdvanceDays, Boolean bookingRequiresConfirmation) {}

    @PatchMapping("/api/salon-admin/{id}/booking-settings")
    ResponseEntity<Salon> patchBookingSettings(@PathVariable UUID id, @RequestBody PatchBookingSettingsRequest request) {
        return service.updateBookingSettings(id, request.bookingAdvanceDays(), request.bookingRequiresConfirmation())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/salon-admin/{id}/features")
    ResponseEntity<Salon> updateFeatures(@PathVariable UUID id, @RequestBody List<SalonFeature> features) {
        return service.updateFeatures(id, features)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/api/salon-admin/{id}")
    ResponseEntity<Salon> disable(@PathVariable UUID id) {
        return service.disable(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/api/salon-admin/{id}/enable")
    ResponseEntity<Salon> enable(@PathVariable UUID id) {
        return service.enable(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    record AddClosureRequest(@NotNull LocalDate startDate, @NotNull LocalDate endDate, String reason) {}

    @GetMapping({"/api/salon/{id}/closures", "/api/salon-admin/{id}/closures"})
    List<SalonClosure> listClosures(@PathVariable UUID id) {
        return service.findClosures(id);
    }

    @PostMapping("/api/salon-admin/{id}/closures")
    ResponseEntity<SalonClosure> addClosure(@PathVariable UUID id, @Valid @RequestBody AddClosureRequest request) {
        var closure = service.addClosure(id, request.startDate(), request.endDate(), request.reason());
        return ResponseEntity.ok(closure);
    }

    @DeleteMapping("/api/salon-admin/{id}/closures/{closureId}")
    ResponseEntity<Void> removeClosure(@PathVariable UUID id, @PathVariable Long closureId) {
        boolean deleted = service.removeClosure(id, closureId);
        return deleted
                ? ResponseEntity.noContent().<Void>build()
                : ResponseEntity.status(HttpStatus.CONFLICT).<Void>build();
    }

    record AddHolidayRequest(
            @NotBlank String name,
            @NotNull Integer month,
            @NotNull Integer day,
            Integer endMonth,
            Integer endDay,
            Integer year) {}

    @GetMapping({"/api/salon/{id}/holidays", "/api/salon-admin/{id}/holidays"})
    List<SalonHoliday> listHolidays(@PathVariable UUID id) {
        return service.findHolidays(id);
    }

    @PostMapping("/api/salon-admin/{id}/holidays")
    ResponseEntity<SalonHoliday> addHoliday(@PathVariable UUID id, @Valid @RequestBody AddHolidayRequest request) {
        var holiday = service.addHoliday(id, request.name(), request.month(), request.day(),
                request.endMonth(), request.endDay(), request.year());
        return ResponseEntity.ok(holiday);
    }

    @DeleteMapping("/api/salon-admin/{id}/holidays/{holidayId}")
    ResponseEntity<Void> removeHoliday(@PathVariable UUID id, @PathVariable Long holidayId) {
        service.removeHoliday(id, holidayId);
        return ResponseEntity.noContent().build();
    }
}
