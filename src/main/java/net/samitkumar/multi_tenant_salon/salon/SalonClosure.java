package net.samitkumar.multi_tenant_salon.salon;

import org.springframework.data.annotation.Id;

import java.time.LocalDate;
import java.util.UUID;

public record SalonClosure(
        @Id Long id,
        UUID salonId,
        LocalDate startDate,
        LocalDate endDate,
        String reason,
        Long holidayId
) {}
