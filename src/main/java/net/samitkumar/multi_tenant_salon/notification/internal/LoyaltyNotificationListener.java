package net.samitkumar.multi_tenant_salon.notification.internal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.loyalty.LoyaltyRedeemedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
class LoyaltyNotificationListener {

    private final NotificationService notificationService;

    @ApplicationModuleListener
    void onLoyaltyRedeemed(LoyaltyRedeemedEvent event) {
        log.info("[NOTIFICATION → CUSTOMER] Loyalty reward '{}' redeemed (code {}) — emailing {}", event.rewardName(), event.code(), event.customerEmail());
        notificationService.notifyLoyaltyRedeemed(event);
    }
}
