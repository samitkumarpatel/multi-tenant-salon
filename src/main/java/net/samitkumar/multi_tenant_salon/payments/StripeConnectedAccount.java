package net.samitkumar.multi_tenant_salon.payments;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Table("stripe_connected_account")
public record StripeConnectedAccount(
        @Id UUID salonId,
        String stripeAccountId,
        String country,
        boolean detailsSubmitted,
        boolean chargesEnabled,
        boolean payoutsEnabled,
        Instant updatedAt
) {}
