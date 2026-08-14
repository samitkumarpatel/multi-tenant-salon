package net.samitkumar.multi_tenant_salon.booking.internal;

import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverride;
import org.springframework.data.repository.ListCrudRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface StaffAvailabilityOverrideRepository extends ListCrudRepository<StaffAvailabilityOverride, Long> {

    List<StaffAvailabilityOverride> findBySalonIdAndStaffId(UUID salonId, Long staffId);

    Optional<StaffAvailabilityOverride> findBySalonIdAndStaffIdAndOverrideDate(UUID salonId, Long staffId, LocalDate overrideDate);
}
