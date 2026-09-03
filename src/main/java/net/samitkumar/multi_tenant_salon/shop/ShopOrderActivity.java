package net.samitkumar.multi_tenant_salon.shop;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

/** Order-level activity log entry — one per significant event on an order. */
@Table("shop_order_activity")
public record ShopOrderActivity(
        @Id Long id,
        Long orderId,
        UUID salonId,
        String type,
        String message,
        String actor,
        boolean notified,
        Instant createdAt
) {}
