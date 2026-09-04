package net.samitkumar.multi_tenant_salon.notification.internal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.shop.CommunicationPreference;
import net.samitkumar.multi_tenant_salon.shop.OrderLineActivityAddedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderLineActivityType;
import net.samitkumar.multi_tenant_salon.shop.OrderPlacedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderStatus;
import net.samitkumar.multi_tenant_salon.shop.OrderStatusChangedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
class ShopNotificationListener {

    private final NotificationService notificationService;

    @ApplicationModuleListener
    void onOrderPlaced(OrderPlacedEvent event) {
        if (event.communicationPreference() == CommunicationPreference.IMPORTANT_ONLY) {
            log.info("[NOTIFICATION] Skipping order placed email for {} (IMPORTANT_ONLY preference)", event.orderNumber());
            return;
        }
        log.info("[NOTIFICATION → CUSTOMER] Order {} placed — notifying {} <{}>",
                event.orderNumber(), event.customerName(), event.customerEmail());
        notificationService.notifyOrderPlaced(event);
    }

    @ApplicationModuleListener
    void onOrderStatusChanged(OrderStatusChangedEvent event) {
        if (event.communicationPreference() == CommunicationPreference.IMPORTANT_ONLY
                && event.newStatus() != OrderStatus.SHIPPED) {
            log.info("[NOTIFICATION] Skipping status email for {} (IMPORTANT_ONLY, status={})",
                    event.orderNumber(), event.newStatus());
            return;
        }
        log.info("[NOTIFICATION → CUSTOMER] Order {} status changed to {} — notifying {} <{}>",
                event.orderNumber(), event.newStatus(), event.customerName(), event.customerEmail());
        notificationService.notifyOrderStatusChanged(event);
    }

    @ApplicationModuleListener
    void onOrderLineActivityAdded(OrderLineActivityAddedEvent event) {
        if (event.type() != OrderLineActivityType.USER_NOTIFIED) {
            return;
        }
        log.info("[NOTIFICATION → CUSTOMER] Order {} line {} — notifying {} <{}>",
                event.orderNumber(), event.orderLineId(), event.customerName(), event.customerEmail());
        notificationService.notifyOrderLineUser(event);
    }
}
