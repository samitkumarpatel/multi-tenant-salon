package net.samitkumar.multi_tenant_salon.salon;

import java.util.UUID;

/** Published whenever a salon admin changes salon settings (profile, features, booking settings, or re-enabling). */
public record SalonUpdatedEvent(UUID salonId, String salonName, String salonHandler, String ownerName, String ownerEmail) {}
