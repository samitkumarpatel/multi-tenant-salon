package net.samitkumar.multi_tenant_saloon.saloon;

import org.springframework.data.annotation.Id;

import java.time.LocalDate;
import java.util.UUID;

public record SaloonClosure(
        @Id Long id,
        UUID saloonId,
        LocalDate startDate,
        LocalDate endDate,
        String reason,
        Long holidayId
) {}
