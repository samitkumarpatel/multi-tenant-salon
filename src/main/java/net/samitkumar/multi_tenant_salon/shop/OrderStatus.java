package net.samitkumar.multi_tenant_salon.shop;

import java.util.EnumSet;
import java.util.Set;

/**
 * Lifecycle of a {@link ShopOrder}. A freshly placed order lands in {@code NEW}; the salon
 * then works it through {@code PROCESSING} → {@code SHIPPED} → {@code FULFILLED}, or
 * {@code CANCELLED} at any point.
 *
 * <p>The open states move freely between themselves — salons skip steps, and a mis-click needs to
 * be correctable. What is not allowed is leaving a {@linkplain #isTerminal() terminal} state: an
 * order that has been cancelled, fulfilled or failed is settled, and reopening it would silently
 * contradict the stock, refund and notification history already written against it.
 */
public enum OrderStatus {
    NEW, CONFIRMED, PROCESSING, READY_TO_SHIP, SHIPPED, DELIVERED, FULFILLED, CANCELLED, FAILED, ON_HOLD;

    private static final Set<OrderStatus> TERMINAL = EnumSet.of(CANCELLED, FULFILLED, FAILED);

    /** Whether this is a settled end state that the order can never move out of again. */
    public boolean isTerminal() {
        return TERMINAL.contains(this);
    }

    /** Whether the goods have left the salon, which is what makes a cancellation too late. */
    public boolean isDispatched() {
        return this == SHIPPED || this == DELIVERED || this == FULFILLED;
    }
}
