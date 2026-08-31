package net.samitkumar.multi_tenant_salon.analytics.internal;

import java.time.LocalDate;
import java.util.List;

record AnalyticsSummary(
        long totalViews,
        long totalClicks,
        List<DailyCount> viewsByDay,
        List<PathCount> topPages,
        List<LabelCount> topClicks) {

    record DailyCount(LocalDate day, long count) {}

    record PathCount(String path, long count) {}

    record LabelCount(String label, long count) {}
}
