package net.samitkumar.multi_tenant_saloon.saloon;

import java.util.List;

public record SaloonCreatedEvent(String saloonId, String saloonName, List<SaloonFeature> features) {}
