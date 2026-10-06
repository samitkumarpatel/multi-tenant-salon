package net.samitkumar.multi_tenant_salon.dashboard;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Table("dashboard_settings")
public record DashboardSettings(
        @Id UUID salonId,
        boolean bookingManagementEnabled,
        boolean cashierEnabled,
        Instant updatedAt
) {}
