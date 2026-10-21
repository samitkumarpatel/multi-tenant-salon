package net.samitkumar.multi_tenant_salon.membership;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Published when a member's paid period is about to end ({@code expired = false}) or has just run out
 * ({@code expired = true}). Drives the email with the renewal link — the salon website's membership
 * page with {@code ?renew=<renewalToken>}, which starts a one-time checkout for the next period.
 */
public record MembershipRenewalDueEvent(
        Long subscriptionId,
        UUID salonId,
        String memberCode,
        String customerName,
        String customerEmail,
        String planName,
        BigDecimal price,
        String currency,
        BillingInterval billingInterval,
        Instant periodEnd,
        boolean expired,
        String renewalToken,
        String salonHandler,
        String salonName,
        String salonPhone,
        String salonEmail
) {}
