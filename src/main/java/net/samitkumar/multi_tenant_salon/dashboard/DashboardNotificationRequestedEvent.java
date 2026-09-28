package net.samitkumar.multi_tenant_salon.dashboard;

import java.time.Instant;
import java.util.UUID;

public record DashboardNotificationRequestedEvent(
        UUID salonId, Long bookingId, String salonName, String customerName,
        String customerEmail, String subject, String message, Instant requestedAt
) {}
