package net.samitkumar.multi_tenant_salon.shop;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Order-level activity log entry — one per significant event on an order.
 *
 * <p>{@code CUSTOMER_NOTIFIED} entries additionally carry the exact message the customer
 * received ({@code channel} / {@code subject} / {@code body} / {@code status}); they are
 * appended when the notification module acknowledges a send via
 * {@link OrderCustomerNotifiedEvent}. For all other types those four fields are null.
 */
@Table("shop_order_activity")
public record ShopOrderActivity(
        @Id Long id,
        Long orderId,
        UUID salonId,
        String type,
        String message,
        String actor,
        boolean notified,
        String channel,
        String subject,
        String body,
        String status,
        Instant createdAt
) {}
