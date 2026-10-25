package net.samitkumar.multi_tenant_salon.customer.internal;

import java.time.Instant;
import java.util.UUID;

/**
 * The salon's own record of a customer, keyed by (salon, email). Bookings, orders and memberships
 * stay keyed by their own {@code customer_email}; this row adds what the owner edits and writes down.
 */
record SalonCustomer(Long id, UUID salonId, String name, String email, String phone, String notes,
                     Instant createdAt, Instant updatedAt, Instant lastSeenAt) {}
