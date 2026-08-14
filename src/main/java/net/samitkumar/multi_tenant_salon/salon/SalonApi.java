package net.samitkumar.multi_tenant_salon.salon;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SalonApi {
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
