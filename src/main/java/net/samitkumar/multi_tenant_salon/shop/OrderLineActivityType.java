package net.samitkumar.multi_tenant_salon.shop;

/**
 * The kinds of entry that appear on an {@link ShopOrder.OrderLine}'s activity timeline.
 * {@code LINE_CREATED} / {@code STATUS_CHANGED} are written automatically; {@code USER_NOTIFIED}
 * and {@code NOTE_ADDED} come from the admin's "Notify User" / "Add a Note" buttons (dummy for now).
 */
public enum OrderLineActivityType {
    LINE_CREATED, STATUS_CHANGED, USER_NOTIFIED, NOTE_ADDED
}
