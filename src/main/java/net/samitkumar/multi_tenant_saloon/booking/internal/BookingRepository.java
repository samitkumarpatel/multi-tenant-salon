package net.samitkumar.multi_tenant_saloon.booking.internal;

import net.samitkumar.multi_tenant_saloon.booking.Booking;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface BookingRepository extends ListCrudRepository<Booking, Long> {

    List<Booking> findBySaloonId(UUID saloonId);

    Optional<Booking> findBySaloonIdAndId(UUID saloonId, Long id);

    @Query("SELECT * FROM booking WHERE saloon_id = :saloonId AND staff_id = :staffId AND appointment_date = :date AND status <> 'CANCELLED'")
    List<Booking> findActiveByStaffOnDate(UUID saloonId, Long staffId, LocalDate date);
}
