package net.samitkumar.multi_tenant_salon.shop;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Table("shop_category")
public record Category(
        @Id Long id,
        UUID salonId,
        String name,
        String description,
        boolean active,
        Instant createdAt
) {}
