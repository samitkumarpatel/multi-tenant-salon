package net.samitkumar.multi_tenant_saloon.staff;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "staff_members")
public record StaffMember(
        @Id String id,
        String saloonId,
        String name,
        String email,
        String phone,
        StaffRole role,
        StaffStatus status,
        List<String> specializations,
        Instant createdAt
) {
    public StaffMember {
        specializations = specializations != null ? List.copyOf(specializations) : List.of();
    }
}
