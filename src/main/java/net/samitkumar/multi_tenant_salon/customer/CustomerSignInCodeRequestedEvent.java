package net.samitkumar.multi_tenant_salon.customer;

import java.time.Instant;
import java.util.UUID;

/**
 * A customer asked to sign in to a salon's self-service account and the salon knows their email, so
 * a one-time code is due. Drives the sign-in email; the code itself is single-use and short-lived,
 * and only its hash is kept in the customer module.
 */
public record CustomerSignInCodeRequestedEvent(
        UUID salonId,
        String salonName,
        String salonPhone,
        String salonEmail,
        String email,
        String code,
        Instant expiresAt
) {}
