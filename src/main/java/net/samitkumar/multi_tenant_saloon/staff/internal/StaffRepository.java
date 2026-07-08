package net.samitkumar.multi_tenant_saloon.staff.internal;

import net.samitkumar.multi_tenant_saloon.staff.StaffMember;
import org.springframework.data.repository.ListCrudRepository;

import java.util.List;
import java.util.UUID;

interface StaffRepository extends ListCrudRepository<StaffMember, Long> {
    List<StaffMember> findBySaloonId(UUID saloonId);
}
