package net.samitkumar.multi_tenant_salon.analytics.internal;

import java.time.Instant;
import java.util.UUID;

/** Wire payload carried on the Azure Storage Queue between ingestion and persistence. */
record QueuedActivityEvent(
        UUID salonId,
        String sessionId,
        AnalyticsEventType eventType,
        String path,
        String label,
        Instant occurredAt
) {}
