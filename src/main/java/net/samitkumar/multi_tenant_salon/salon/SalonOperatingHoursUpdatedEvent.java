package net.samitkumar.multi_tenant_salon.salon;

import java.util.List;
import java.util.UUID;

public record SalonOperatingHoursUpdatedEvent(UUID salonId, List<Salon.OperatingHours> operatingHours) {}
