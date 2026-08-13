package net.samitkumar.multi_tenant_saloon.staff;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StaffApi {
    Optional<StaffMember> findByIdAndSaloonId(Long id, UUID saloonId);
    Optional<StaffMember> findById(Long staffId);
    List<StaffMember> findBySaloonId(UUID saloonId);
    List<StaffMember> findAvailableForBookingBySaloonId(UUID saloonId);
    List<StaffMember> findByEmail(String email);
    Optional<StaffMember> updateProfile(Long staffId, String name, String phone,
                                        List<String> specializations, Boolean availableForBooking, String photoUrl);
}
