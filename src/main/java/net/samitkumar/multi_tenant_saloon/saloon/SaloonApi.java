package net.samitkumar.multi_tenant_saloon.saloon;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface SaloonApi {
    List<Saloon.OperatingHours> findOperatingHours(UUID saloonId);
    boolean isClosedOn(UUID saloonId, LocalDate date);
    List<SaloonClosure> findClosures(UUID saloonId);
}
