package net.samitkumar.multi_tenant_salon.dashboard.internal;

import net.samitkumar.multi_tenant_salon.dashboard.DashboardSettings;
import net.samitkumar.multi_tenant_salon.dashboard.PosSale;
import org.springframework.data.repository.ListCrudRepository;

import java.util.List;
import java.util.UUID;

interface DashboardSettingsRepository extends ListCrudRepository<DashboardSettings, UUID> {}

interface PosSaleRepository extends ListCrudRepository<PosSale, Long> {
    List<PosSale> findTop50BySalonIdOrderByCreatedAtDesc(UUID salonId);
}
