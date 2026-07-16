package net.samitkumar.multi_tenant_saloon.saloon;

import java.util.List;
import java.util.UUID;

public record SaloonCreatedEvent(UUID saloonId, String saloonName, String ownerName, String ownerEmail, String ownerPhone, List<SaloonFeature> features) {}
