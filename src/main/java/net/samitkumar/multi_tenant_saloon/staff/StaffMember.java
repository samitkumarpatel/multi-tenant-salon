package net.samitkumar.multi_tenant_saloon.staff;

import com.fasterxml.jackson.annotation.JsonValue;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Table("staff_member")
public record StaffMember(
        @Id Long id,
        UUID saloonId,
        String name,
        String email,
        String phone,
        StaffRole role,
        StaffStatus status,
        @MappedCollection(idColumn = "staff_member_id") List<Specialization> specializations,
        Instant createdAt
) {
    public StaffMember {
        specializations = specializations != null ? List.copyOf(specializations) : List.of();
    }

    @Table("staff_member_specialization")
    public record Specialization(@JsonValue String value) {}
}
