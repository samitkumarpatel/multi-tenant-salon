package net.samitkumar.multi_tenant_salon.shop;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * One entry on an {@link ShopOrder.OrderLine}'s activity timeline. Its own aggregate (not a
 * nested collection of the order) so appending an entry is a plain insert that leaves the order
 * and its line rows untouched.
 */
@Table("shop_order_line_activity")
public record OrderLineActivity(
        @Id Long id,
        Long orderLineId,
        UUID salonId,
        OrderLineActivityType type,
        String message,
        String actor,
        Instant createdAt
) {}
