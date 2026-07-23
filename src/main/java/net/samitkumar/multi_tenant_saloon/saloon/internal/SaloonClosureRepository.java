package net.samitkumar.multi_tenant_saloon.saloon.internal;

import net.samitkumar.multi_tenant_saloon.saloon.SaloonClosure;
import org.springframework.data.repository.CrudRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

interface SaloonClosureRepository extends CrudRepository<SaloonClosure, Long> {
    List<SaloonClosure> findBySaloonId(UUID saloonId);
    List<SaloonClosure> findBySaloonIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(
            UUID saloonId, LocalDate date1, LocalDate date2);
}
