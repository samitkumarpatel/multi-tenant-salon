package net.samitkumar.multi_tenant_salon.salon;

import java.util.UUID;

public record SalonDisabledEvent(UUID salonId, String salonName, String ownerName, String ownerEmail) {}
