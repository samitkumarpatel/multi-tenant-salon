package net.samitkumar.multi_tenant_saloon.saloon;

import java.util.List;
import java.util.UUID;

public record SaloonOperatingHoursUpdatedEvent(UUID saloonId, List<Saloon.OperatingHours> operatingHours) {}
