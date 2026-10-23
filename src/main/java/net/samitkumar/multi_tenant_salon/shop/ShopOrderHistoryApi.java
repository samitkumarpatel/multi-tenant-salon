package net.samitkumar.multi_tenant_salon.shop;

import java.util.List;
import java.util.UUID;

/**
 * A customer's own order history, for the customer self-service account. Read-only, and limited to
 * what the customer may see: checkouts whose payment failed or was abandoned are left out, and so is
 * every staff-only timeline entry (work notes).
 */
public interface ShopOrderHistoryApi {

    /** One order with the timeline entries the customer may see, oldest first. */
    record CustomerOrder(ShopOrder order, List<ShopOrderActivity> timeline) {}

    /** Every order the salon holds under {@code email} (matched case-insensitively), newest first. */
    List<CustomerOrder> findByCustomerEmail(UUID salonId, String email);
}
