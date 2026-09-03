package net.samitkumar.multi_tenant_salon.shop;

/**
 * Lifecycle of a {@link ShopOrder}. A freshly placed order lands in {@code NEW}; the salon
 * then works it through {@code PROCESSING} → {@code SHIPPED} → {@code FULFILLED}, or
 * {@code CANCELLED} at any point.
 */
public enum OrderStatus {
    NEW, PROCESSING, SHIPPED, FULFILLED, CANCELLED
}
