package net.samitkumar.multi_tenant_salon.analytics.internal;

import java.util.List;

record GenUiSummary(
        long totalSessions,
        long totalMessages,
        long totalBookingsProposed,
        List<ComponentCount> topComponents,
        List<ToolCount> topTools) {

    record ComponentCount(String type, long count) {}

    record ToolCount(String tool, long count) {}
}
