package net.samitkumar.multi_tenant_salon.booking;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.LocalDate;

public interface BookingApi {
    Optional<Booking> findById(UUID salonId, Long bookingId);
    List<Booking> findByStaff(UUID salonId, Long staffId);
    List<StaffAvailabilityOverride> getOverrides(UUID salonId, Long staffId);
    StaffAvailabilityOverride addOverride(UUID salonId, Long staffId, StaffAvailabilityOverride override);
    void removeOverride(UUID salonId, Long staffId, Long overrideId);
    List<AvailableSlot> findAvailableSlots(UUID salonId, Long serviceId, LocalDate date, Long staffId);
    SalonAvailability queryAvailability(UUID salonId, Long serviceId, Long staffId, LocalDate from, LocalDate to,
                                        SalonAvailability.Granularity granularity, Integer limit);
}
