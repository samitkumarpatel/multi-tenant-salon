package net.samitkumar.multi_tenant_salon.notification.internal;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.membership.MembershipActivatedEvent;
import net.samitkumar.multi_tenant_salon.membership.MembershipCancelledEvent;
import net.samitkumar.multi_tenant_salon.membership.MembershipRenewalDueEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
class MembershipNotificationListener {

    private final NotificationService notificationService;

    @ApplicationModuleListener
    void onMembershipActivated(MembershipActivatedEvent event) {
        log.info("[NOTIFICATION → MEMBER] Membership {} ({}) {} — sending QR code to {} <{}>",
                event.subscriptionId(), event.planName(), event.kind(), event.customerName(), event.customerEmail());
        notificationService.notifyMembershipActivated(event);
    }

    @ApplicationModuleListener
    void onMembershipCancelled(MembershipCancelledEvent event) {
        log.info("[NOTIFICATION → MEMBER] Membership {} cancelled (immediate={}) — notifying {} <{}>",
                event.subscriptionId(), event.immediate(), event.customerName(), event.customerEmail());
        notificationService.notifyMembershipCancelled(event);
    }

    @ApplicationModuleListener
    void onRenewalDue(MembershipRenewalDueEvent event) {
        log.info("[NOTIFICATION → MEMBER] Membership {} renewal due (expired={}) — notifying {} <{}>",
                event.subscriptionId(), event.expired(), event.customerName(), event.customerEmail());
        notificationService.notifyMembershipRenewalDue(event);
    }
}
