package net.samitkumar.multi_tenant_salon.salon;

import java.util.List;
import java.util.UUID;

public record SalonCreatedEvent(UUID salonId, String salonName, String salonHandler, String ownerName, String ownerEmail, String ownerPhone, List<SalonFeature> features) {}
