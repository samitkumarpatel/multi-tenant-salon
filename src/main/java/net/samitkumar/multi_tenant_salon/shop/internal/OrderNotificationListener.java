package net.samitkumar.multi_tenant_salon.shop.internal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.shop.OrderCustomerNotifiedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Closes the notification round-trip: the shop module asks for a customer to be notified
 * (via {@code OrderPlacedEvent} / {@code OrderStatusChangedEvent} / {@code OrderLineActivityAddedEvent}),
 * the notification module sends the email and acknowledges with {@link OrderCustomerNotifiedEvent},
 * and here we append the exact message to that order's activity timeline.
 */
@Component
@RequiredArgsConstructor
@Slf4j
class OrderNotificationListener {

    private final ShopManager shop;

    @ApplicationModuleListener
    void onCustomerNotified(OrderCustomerNotifiedEvent event) {
        log.info("[shop] Customer notified for order {} — recording on timeline ({}, {})",
                event.orderNumber(), event.channel(), event.status());
        shop.recordCustomerNotification(event.salonId(), event.orderNumber(), event.channel(),
                event.recipient(), event.subject(), event.body(), event.status(), event.sentAt());
    }
}
