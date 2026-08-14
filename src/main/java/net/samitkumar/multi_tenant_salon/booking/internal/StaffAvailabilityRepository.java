package net.samitkumar.multi_tenant_salon.booking.internal;

import net.samitkumar.multi_tenant_salon.booking.StaffAvailability;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface StaffAvailabilityRepository extends ListCrudRepository<StaffAvailability, Long> {

    List<StaffAvailability> findBySalonIdAndStaffId(UUID salonId, Long staffId);

    Optional<StaffAvailability> findBySalonIdAndStaffIdAndDayOfWeek(UUID salonId, Long staffId, DayOfWeek dayOfWeek);

    List<StaffAvailability> findBySalonId(UUID salonId);

    @Modifying
    @Query("DELETE FROM staff_availability WHERE salon_id = :salonId AND staff_id = :staffId")
    void deleteBySalonIdAndStaffId(UUID salonId, Long staffId);

    @Modifying
    @Query("DELETE FROM staff_availability WHERE salon_id = :salonId AND staff_id = :staffId AND day_of_week = :dayOfWeek")
    void deleteBySalonIdAndStaffIdAndDayOfWeek(UUID salonId, Long staffId, DayOfWeek dayOfWeek);
}
