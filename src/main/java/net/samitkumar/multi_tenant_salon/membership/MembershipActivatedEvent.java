package net.samitkumar.multi_tenant_salon.membership;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Published when a membership period is paid — the first payment ({@link Kind#WELCOME}) or a renewal
 * ({@link Kind#RENEWED}) — and when the salon resends the card ({@link Kind#RESEND}). Drives the
 * email carrying the member's QR code.
 */
public record MembershipActivatedEvent(
        Long subscriptionId,
        UUID salonId,
        String memberCode,
        String customerName,
        String customerEmail,
        String planName,
        BigDecimal price,
        String currency,
        BillingInterval billingInterval,
        Instant currentPeriodEnd,
        List<String> perks,
        String salonName,
        String salonPhone,
        String salonEmail,
        Kind kind
) {
    public enum Kind { WELCOME, RENEWED, RESEND }
}
