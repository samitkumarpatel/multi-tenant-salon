package net.samitkumar.multi_tenant_salon.shop;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Table("shop_brand")
public record Brand(
        @Id Long id,
        UUID salonId,
        String name,
        String description,
        String logoUrl,
        boolean active,
        Instant createdAt
) {}
