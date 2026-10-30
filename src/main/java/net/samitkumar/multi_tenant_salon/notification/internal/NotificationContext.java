package net.samitkumar.multi_tenant_salon.notification.internal;

import java.util.UUID;

/**
 * Links a dispatched notification back to the business entity it concerns, so it can be
 * persisted to {@code notification_log} and surfaced later (e.g. an order's Activity view).
 */
record NotificationContext(UUID salonId, String relatedType, String relatedRef, Long sourceLineActivityId) {
    NotificationContext(UUID salonId, String relatedType, String relatedRef) {
        this(salonId, relatedType, relatedRef, null);
    }

    NotificationContext forLine(Long activityId) {
        return new NotificationContext(salonId, relatedType, relatedRef, activityId);
    }


    static final String TYPE_SHOP_ORDER = "SHOP_ORDER";
    static final String TYPE_MEMBERSHIP = "MEMBERSHIP";

    static NotificationContext shopOrder(UUID salonId, String orderNumber) {
        return new NotificationContext(salonId, TYPE_SHOP_ORDER, orderNumber);
    }

    static NotificationContext membership(UUID salonId, Long subscriptionId) {
        return new NotificationContext(salonId, TYPE_MEMBERSHIP, String.valueOf(subscriptionId));
    }
}
