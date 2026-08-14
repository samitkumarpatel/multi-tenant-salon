package net.samitkumar.multi_tenant_salon.staff.internal;

import net.samitkumar.multi_tenant_salon.staff.StaffMember;
import org.springframework.data.repository.ListCrudRepository;

import java.util.List;
import java.util.UUID;

interface StaffRepository extends ListCrudRepository<StaffMember, Long> {
    List<StaffMember> findBySalonId(UUID salonId);
    List<StaffMember> findBySalonIdAndAvailableForBookingTrue(UUID salonId);
    List<StaffMember> findByEmail(String email);
}
