package net.samitkumar.multi_tenant_salon.salonservice;

import com.fasterxml.jackson.annotation.JsonValue;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Table("service_item")
public record ServiceItem(
        @Id Long id,
        UUID salonId,
        String name,
        String description,
        BigDecimal price,
        String currency,
        Integer durationMinutes,
        ServiceCategory category,
        boolean active,
        @MappedCollection(idColumn = "service_item_id") List<AssignedStaff> assignedStaffIds,
        Instant createdAt
) {
    public ServiceItem {
        assignedStaffIds = assignedStaffIds != null ? List.copyOf(assignedStaffIds) : List.of();
    }

    @Table("service_item_assigned_staff")
    public record AssignedStaff(@JsonValue String staffId) {}
}
