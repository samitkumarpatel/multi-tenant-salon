package net.samitkumar.multi_tenant_saloon.booking.internal;

import net.samitkumar.multi_tenant_saloon.booking.StaffAvailability;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface StaffAvailabilityRepository extends ListCrudRepository<StaffAvailability, Long> {

    List<StaffAvailability> findBySaloonIdAndStaffId(UUID saloonId, Long staffId);

    Optional<StaffAvailability> findBySaloonIdAndStaffIdAndDayOfWeek(UUID saloonId, Long staffId, DayOfWeek dayOfWeek);

    List<StaffAvailability> findBySaloonId(UUID saloonId);

    @Modifying
    @Query("DELETE FROM staff_availability WHERE saloon_id = :saloonId AND staff_id = :staffId")
    void deleteBySaloonIdAndStaffId(UUID saloonId, Long staffId);

    @Modifying
    @Query("DELETE FROM staff_availability WHERE saloon_id = :saloonId AND staff_id = :staffId AND day_of_week = :dayOfWeek")
    void deleteBySaloonIdAndStaffIdAndDayOfWeek(UUID saloonId, Long staffId, DayOfWeek dayOfWeek);
}
