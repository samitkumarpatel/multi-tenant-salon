package net.samitkumar.multi_tenant_salon.staff;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StaffApi {
    Optional<StaffMember> findByIdAndSalonId(Long id, UUID salonId);
    Optional<StaffMember> findById(Long staffId);
    List<StaffMember> findBySalonId(UUID salonId);
    List<StaffMember> findAvailableForBookingBySalonId(UUID salonId);
    List<StaffMember> findByEmail(String email);
    Optional<StaffMember> updateProfile(Long staffId, String name, String phone,
                                        List<String> specializations, Boolean availableForBooking, String photoUrl);
}
