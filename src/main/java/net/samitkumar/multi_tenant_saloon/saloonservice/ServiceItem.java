package net.samitkumar.multi_tenant_saloon.saloonservice;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Document(collection = "catalog_items")
public record ServiceItem(
        @Id String id,
        String saloonId,
        String name,
        String description,
        BigDecimal price,
        String currency,
        int durationMinutes,
        ServiceCategory category,
        boolean active,
        List<String> assignedStaffIds,
        Instant createdAt
) {
    public ServiceItem {
        assignedStaffIds = assignedStaffIds != null ? List.copyOf(assignedStaffIds) : List.of();
    }
}
