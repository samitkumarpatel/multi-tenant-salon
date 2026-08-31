package net.samitkumar.multi_tenant_salon.analytics.internal;

import org.springframework.data.repository.ListCrudRepository;

interface AnalyticsEventRepository extends ListCrudRepository<AnalyticsEvent, Long> {
}
