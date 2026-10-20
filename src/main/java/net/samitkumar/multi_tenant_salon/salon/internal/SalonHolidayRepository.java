package net.samitkumar.multi_tenant_salon.salon.internal;

import net.samitkumar.multi_tenant_salon.salon.SalonHoliday;
import org.springframework.data.repository.ListCrudRepository;

import java.util.List;
import java.util.UUID;

interface SalonHolidayRepository extends ListCrudRepository<SalonHoliday, Long> {

    List<SalonHoliday> findBySalonId(UUID salonId);

}
