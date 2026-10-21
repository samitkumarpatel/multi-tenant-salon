package net.samitkumar.multi_tenant_salon.membership;

import java.time.Instant;
import java.util.UUID;

/**
 * Published when a membership is cancelled — immediately ({@code immediate}, {@code endsAt} is now)
 * or at the end of the period already paid for. Drives the member's cancellation email.
 */
public record MembershipCancelledEvent(
        Long subscriptionId,
        UUID salonId,
        String memberCode,
        String customerName,
        String customerEmail,
        String planName,
        Instant endsAt,
        boolean immediate,
        String salonName,
        String salonPhone,
        String salonEmail
) {}
