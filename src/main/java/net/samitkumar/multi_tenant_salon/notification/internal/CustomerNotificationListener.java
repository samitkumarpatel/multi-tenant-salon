package net.samitkumar.multi_tenant_salon.notification.internal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.customer.CustomerSignInCodeRequestedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
class CustomerNotificationListener {

    private final NotificationService notificationService;

    @ApplicationModuleListener
    void onSignInCodeRequested(CustomerSignInCodeRequestedEvent event) {
        log.info("[NOTIFICATION → CUSTOMER] Sign-in code for salon {} — sending to <{}>", event.salonId(), event.email());
        notificationService.notifyCustomerSignInCode(event);
    }
}
