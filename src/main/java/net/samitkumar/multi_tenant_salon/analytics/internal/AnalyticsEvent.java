package net.samitkumar.multi_tenant_salon.analytics.internal;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Table("analytics_event")
record AnalyticsEvent(
        @Id Long id,
        UUID salonId,
        AnalyticsEventType eventType,
        String path,
        String label,
        String sessionId,
        Instant occurredAt,
        Instant receivedAt
) {}
