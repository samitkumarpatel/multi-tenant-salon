package net.samitkumar.multi_tenant_salon.notification.internal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.dashboard.DashboardNotificationRequestedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
class DashboardNotificationListener {
    private final NotificationService notifications;

    @ApplicationModuleListener
    void onNotificationRequested(DashboardNotificationRequestedEvent event) {
        log.info("[NOTIFICATION → CUSTOMER] Dashboard message for booking #{} to <{}>",
                event.bookingId(), event.customerEmail());
        notifications.notifyDashboardCustomer(event);
    }
}
