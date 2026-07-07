package net.samitkumar.multi_tenant_saloon.staff.internal;

import net.samitkumar.multi_tenant_saloon.staff.StaffMember;
import net.samitkumar.multi_tenant_saloon.staff.StaffRole;
import net.samitkumar.multi_tenant_saloon.staff.StaffStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
class StaffService {

    private final StaffRepository repository;

    StaffService(StaffRepository repository) {
        this.repository = repository;
    }

    List<StaffMember> findBySaloonId(Long saloonId) {
        return repository.findBySaloonId(saloonId);
    }

    Optional<StaffMember> findById(Long saloonId, Long staffId) {
        return repository.findById(staffId).filter(m -> m.saloonId().equals(saloonId));
    }

    StaffMember onboard(Long saloonId, String name, String email, String phone, StaffRole role,
                        List<String> specializations) {
        var specs = specializations != null
                ? specializations.stream().map(StaffMember.Specialization::new).toList()
                : List.<StaffMember.Specialization>of();
        var member = new StaffMember(null, saloonId, name, email, phone, role, StaffStatus.ACTIVE,
                specs, Instant.now());
        return repository.save(member);
    }

    Optional<StaffMember> update(Long saloonId, Long staffId, String name, String email, String phone,
                                 StaffRole role, StaffStatus status, List<String> specializations) {
        var specs = specializations != null
                ? specializations.stream().map(StaffMember.Specialization::new).toList()
                : List.<StaffMember.Specialization>of();
        return repository.findById(staffId)
                .filter(m -> m.saloonId().equals(saloonId))
                .map(existing -> {
                    var updated = new StaffMember(existing.id(), existing.saloonId(), name, email, phone,
                            role, status, specs, existing.createdAt());
                    return repository.save(updated);
                });
    }

    void remove(Long saloonId, Long staffId) {
        repository.findById(staffId)
                .filter(m -> m.saloonId().equals(saloonId))
                .ifPresent(m -> repository.deleteById(staffId));
    }
}
