package net.samitkumar.multi_tenant_saloon.saloon;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SaloonApi {
    List<Saloon.OperatingHours> findOperatingHours(UUID saloonId);
    boolean isClosedOn(UUID saloonId, LocalDate date);
    List<SaloonClosure> findClosures(UUID saloonId);
    List<SaloonHoliday> findHolidays(UUID saloonId);
    boolean bookingRequiresConfirmation(UUID saloonId);

    // Super-admin operations
    List<Saloon> findAll();
    Optional<Saloon> findById(UUID id);
    Optional<Saloon> updateFeatures(UUID id, List<SaloonFeature> features);
    Optional<Saloon> disable(UUID id);
    Optional<Saloon> enable(UUID id);
}
