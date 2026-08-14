package net.samitkumar.multi_tenant_salon.salon.internal;

import net.samitkumar.multi_tenant_salon.salon.SalonClosure;
import org.springframework.data.repository.CrudRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

interface SalonClosureRepository extends CrudRepository<SalonClosure, Long> {
    List<SalonClosure> findBySalonId(UUID salonId);
    List<SalonClosure> findBySalonIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
            UUID salonId, LocalDate date1, LocalDate date2);
}
