package net.samitkumar.multi_tenant_salon.customer.internal;

import net.samitkumar.multi_tenant_salon.booking.BookingCreatedEvent;
import net.samitkumar.multi_tenant_salon.membership.MembershipActivatedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderPlacedEvent;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

/**
 * Keeps the owner's customer list current: whoever books, orders or joins is added (or marked as seen
 * again). Idempotent — see {@link CustomerDirectory#seen}.
 */
@Component
class CustomerDirectoryListeners {

    private final CustomerDirectory directory;

    CustomerDirectoryListeners(CustomerDirectory directory) {
        this.directory = directory;
    }

    @ApplicationModuleListener
    void on(BookingCreatedEvent e) {
        directory.seen(e.salonId(), e.customerName(), e.customerEmail(), e.customerPhone());
    }

    @ApplicationModuleListener
    void on(OrderPlacedEvent e) {
        directory.seen(e.salonId(), e.customerName(), e.customerEmail(), e.customerPhone());
    }

    @ApplicationModuleListener
    void on(MembershipActivatedEvent e) {
        directory.seen(e.salonId(), e.customerName(), e.customerEmail(), null);
    }
}
