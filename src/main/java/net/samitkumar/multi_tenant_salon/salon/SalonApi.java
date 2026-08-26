package net.samitkumar.multi_tenant_salon.salon;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SalonApi {
    /**
     * Resolves a path segment that may be either a salon UUID or its handler slug to the real
     * salon UUID (UUID form tried first, falls back to a handler lookup) — the same rule
     * {@code GET /api/salon/{salonIdOrHandler}} already applies. Throws 404 if neither matches.
     */
    UUID resolveId(String idOrHandler);

    List<Salon.OperatingHours> findOperatingHours(UUID salonId);
    boolean isClosedOn(UUID salonId, LocalDate date);
    List<SalonClosure> findClosures(UUID salonId);
    List<SalonHoliday> findHolidays(UUID salonId);
    boolean bookingRequiresConfirmation(UUID salonId);

    // Super-admin operations
    List<Salon> findAll();
    List<Salon> search(String q, Salon.SalonStatus status);
    Optional<Salon> findById(UUID id);
    Optional<Salon> updateFeatures(UUID id, List<SalonFeature> features);
    Optional<Salon> updateOwner(UUID id, Salon.Owner owner);
    Optional<Salon> disable(UUID id);
    Optional<Salon> enable(UUID id);
}
