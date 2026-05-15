package net.samitkumar.multi_tenant_saloon.staff.internal;

import net.samitkumar.multi_tenant_saloon.staff.StaffMember;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

interface StaffRepository extends MongoRepository<StaffMember, String> {
    List<StaffMember> findBySaloonId(String saloonId);
}
