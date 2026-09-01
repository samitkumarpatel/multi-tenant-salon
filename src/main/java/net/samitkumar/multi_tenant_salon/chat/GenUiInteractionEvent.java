package net.samitkumar.multi_tenant_salon.chat;

import java.time.Instant;

/**
 * Published once per notable happening in a Generative-UI chat turn (see {@link GenUiEventType}).
 * {@code salonId} is the raw path segment the chat request came in on (UUID or handler slug,
 * unresolved) - listeners that need the real salon UUID resolve it themselves via
 * {@code SalonApi.resolveId}, the same way other public-facing endpoints do.
 */
public record GenUiInteractionEvent(
        String salonId,
        String sessionId,
        GenUiEventType type,
        String detail,
        Instant occurredAt
) {}
