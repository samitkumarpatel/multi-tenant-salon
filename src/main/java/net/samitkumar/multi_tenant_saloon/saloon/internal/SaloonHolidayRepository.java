package net.samitkumar.multi_tenant_saloon.saloon.internal;

import net.samitkumar.multi_tenant_saloon.saloon.SaloonHoliday;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;

import java.util.List;
import java.util.UUID;

interface SaloonHolidayRepository extends ListCrudRepository<SaloonHoliday, Long> {

    List<SaloonHoliday> findBySaloonId(UUID saloonId);

    @Query("SELECT * FROM saloon_holiday WHERE saloon_id = :saloonId AND holiday_month = :month AND holiday_day = :day AND (year IS NULL OR year = :year)")
    List<SaloonHoliday> findMatchingHolidays(UUID saloonId, int month, int day, int year);
}
