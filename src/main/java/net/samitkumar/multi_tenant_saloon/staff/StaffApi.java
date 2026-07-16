package net.samitkumar.multi_tenant_saloon.staff;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StaffApi {
    Optional<StaffMember> findByIdAndSaloonId(Long id, UUID saloonId);
    List<StaffMember> findBySaloonId(UUID saloonId);
    List<StaffMember> findAvailableForBookingBySaloonId(UUID saloonId);
}
