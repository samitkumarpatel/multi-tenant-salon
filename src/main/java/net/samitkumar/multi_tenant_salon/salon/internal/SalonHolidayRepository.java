package net.samitkumar.multi_tenant_salon.salon.internal;

import net.samitkumar.multi_tenant_salon.salon.SalonHoliday;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;

import java.util.List;
import java.util.UUID;

interface SalonHolidayRepository extends ListCrudRepository<SalonHoliday, Long> {

    List<SalonHoliday> findBySalonId(UUID salonId);

    @Query("SELECT * FROM salon_holiday WHERE salon_id = :salonId AND holiday_month = :month AND holiday_day = :day AND (year IS NULL OR year = :year)")
    List<SalonHoliday> findMatchingHolidays(UUID salonId, int month, int day, int year);
}
