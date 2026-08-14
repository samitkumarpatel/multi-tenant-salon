package net.samitkumar.multi_tenant_salon.booking;

import java.util.List;
import java.util.UUID;

public interface BookingApi {
    List<Booking> findByStaff(UUID salonId, Long staffId);
    List<StaffAvailabilityOverride> getOverrides(UUID salonId, Long staffId);
    StaffAvailabilityOverride addOverride(UUID salonId, Long staffId, StaffAvailabilityOverride override);
    void removeOverride(UUID salonId, Long staffId, Long overrideId);
}
