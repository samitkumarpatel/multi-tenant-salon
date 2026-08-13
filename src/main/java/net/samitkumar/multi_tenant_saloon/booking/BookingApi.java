package net.samitkumar.multi_tenant_saloon.booking;

import java.util.List;
import java.util.UUID;

public interface BookingApi {
    List<Booking> findByStaff(UUID saloonId, Long staffId);
    List<StaffAvailabilityOverride> getOverrides(UUID saloonId, Long staffId);
    StaffAvailabilityOverride addOverride(UUID saloonId, Long staffId, StaffAvailabilityOverride override);
    void removeOverride(UUID saloonId, Long staffId, Long overrideId);
}
