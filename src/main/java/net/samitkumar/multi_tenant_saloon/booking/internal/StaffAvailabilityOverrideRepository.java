package net.samitkumar.multi_tenant_saloon.booking.internal;

import net.samitkumar.multi_tenant_saloon.booking.StaffAvailabilityOverride;
import org.springframework.data.repository.ListCrudRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface StaffAvailabilityOverrideRepository extends ListCrudRepository<StaffAvailabilityOverride, Long> {

    List<StaffAvailabilityOverride> findBySaloonIdAndStaffId(UUID saloonId, Long staffId);

    Optional<StaffAvailabilityOverride> findBySaloonIdAndStaffIdAndOverrideDate(UUID saloonId, Long staffId, LocalDate overrideDate);
}
