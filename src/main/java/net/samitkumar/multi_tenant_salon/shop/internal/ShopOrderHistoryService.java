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

    private final org.springframework.jdbc.core.simple.JdbcClient jdbc;
    private final ShopOrderRepository orders;
    private final ShopOrderActivityRepository activities;

    ShopOrderHistoryService(ShopOrderRepository orders, ShopOrderActivityRepository activities, org.springframework.jdbc.core.simple.JdbcClient jdbc) {
        this.jdbc = jdbc;
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
        jdbc.sql("UPDATE shop_order_communication SET recipient=NULL,recipient_name=NULL,html_body=NULL,failure_reason='Customer contact details have been removed.' WHERE salon_id=:salon AND order_id IN (SELECT id FROM shop_order WHERE salon_id=:salon AND customer_email=:replacement)")
                .param("salon", salonId).param("replacement", replacementEmail).update();
        jdbc.sql("UPDATE shop_order_activity SET message='Details removed for deleted customer', actor=CASE WHEN lower(btrim(actor))=lower(btrim(:email)) THEN 'Deleted user' ELSE actor END WHERE order_id IN (SELECT id FROM shop_order WHERE salon_id=:salon AND customer_email=:replacement)")
                .param("email",email).param("salon",salonId).param("replacement",replacementEmail).update();
        jdbc.sql("UPDATE shop_order_line_activity SET message='Details removed for deleted customer', actor=CASE WHEN lower(btrim(actor))=lower(btrim(:email)) THEN 'Deleted user' ELSE actor END WHERE order_line_id IN (SELECT l.id FROM shop_order_line l JOIN shop_order o ON o.id=l.order_id WHERE o.salon_id=:salon AND o.customer_email=:replacement)")
                .param("email",email).param("salon",salonId).param("replacement",replacementEmail).update();
        return count;
    }
}
