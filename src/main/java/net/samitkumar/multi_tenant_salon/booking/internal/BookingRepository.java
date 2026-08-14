package net.samitkumar.multi_tenant_salon.booking.internal;

import net.samitkumar.multi_tenant_salon.booking.Booking;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface BookingRepository extends ListCrudRepository<Booking, Long> {

    List<Booking> findBySalonId(UUID salonId);

    Optional<Booking> findBySalonIdAndId(UUID salonId, Long id);

    @Query("SELECT * FROM booking WHERE salon_id = :salonId AND staff_id = :staffId AND appointment_date = :date AND status <> 'CANCELLED'")
    List<Booking> findActiveByStaffOnDate(UUID salonId, Long staffId, LocalDate date);

    List<Booking> findBySalonIdAndStaffId(UUID salonId, Long staffId);
}
