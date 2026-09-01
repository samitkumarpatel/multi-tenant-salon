package net.samitkumar.multi_tenant_salon.analytics.internal;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Table("genui_event")
record GenUiEvent(
        @Id Long id,
        UUID salonId,
        String sessionId,
        String eventType,
        String detail,
        Instant occurredAt
) {}
