package net.samitkumar.multi_tenant_saloon.saloon;

import java.util.List;
import java.util.UUID;

public interface SaloonApi {
    List<Saloon.OperatingHours> findOperatingHours(UUID saloonId);
}
