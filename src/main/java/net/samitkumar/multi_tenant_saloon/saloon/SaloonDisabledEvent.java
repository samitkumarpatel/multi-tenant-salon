package net.samitkumar.multi_tenant_saloon.saloon;

import java.util.UUID;

public record SaloonDisabledEvent(UUID saloonId, String saloonName, String ownerName, String ownerEmail) {}
