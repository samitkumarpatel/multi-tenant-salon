package net.samitkumar.multi_tenant_salon.shop.internal;

import net.samitkumar.multi_tenant_salon.shop.PaymentStatus;
import net.samitkumar.multi_tenant_salon.shop.ShopOrderHistoryApi;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
class ShopOrderHistoryService implements ShopOrderHistoryApi {

    /** Notes the salon writes for itself; never shown to the customer. */
    private static final Set<String> STAFF_ONLY = Set.of("WORK_NOTE");

    private final ShopOrderRepository orders;
    private final ShopOrderActivityRepository activities;

    ShopOrderHistoryService(ShopOrderRepository orders, ShopOrderActivityRepository activities) {
        this.orders = orders;
        this.activities = activities;
    }

    @Override
    public List<CustomerOrder> findByCustomerEmail(UUID salonId, String email) {
        return orders.findByCustomerEmail(salonId, email).stream()
                // A failed or expired Stripe checkout restocks its lines and was never an order to the customer.
                .filter(o -> o.paymentStatus() != PaymentStatus.FAILED && o.paymentStatus() != PaymentStatus.VOIDED)
                .map(o -> new CustomerOrder(o, activities.findByOrderIdOrderByCreatedAtAsc(o.id()).stream()
                        .filter(a -> !STAFF_ONLY.contains(a.type()))
                        .toList()))
                .toList();
    }

    @Override
    @Transactional
    public int anonymizeCustomer(UUID salonId, String email, String replacementEmail) {
        var count = orders.anonymizeCustomer(salonId, email, replacementEmail);
        // Runs after the orders carry the replacement address, which is how their timelines are found.
        activities.redactNotifiedEmails(salonId, replacementEmail);
        return count;
    }
}
