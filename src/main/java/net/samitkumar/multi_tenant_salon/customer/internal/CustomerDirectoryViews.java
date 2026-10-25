package net.samitkumar.multi_tenant_salon.customer.internal;

import net.samitkumar.multi_tenant_salon.customer.internal.CustomerAccountViews.Account;

import java.util.List;

final class CustomerDirectoryViews {

    private CustomerDirectoryViews() {}

    /** One page of the owner's customer list. */
    record CustomerPage(List<SalonCustomer> content, int page, int size, long totalElements, int totalPages) {}

    /** The email is the customer's identity in this salon, so it is set on create and never edited. */
    record CustomerSpec(String name, String email, String phone, String notes) {}

    /**
     * One customer with everything the salon holds under their email. {@code deleteBlockedReason} is set
     * (and {@code canDelete} false) while an active membership or an upcoming appointment forbids erasing them.
     */
    record CustomerDetail(SalonCustomer customer, Account history, boolean canDelete, String deleteBlockedReason) {}
}
