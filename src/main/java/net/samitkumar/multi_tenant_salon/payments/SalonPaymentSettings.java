package net.samitkumar.multi_tenant_salon.payments;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Table("salon_payment_settings")
public record SalonPaymentSettings(
        @Id UUID salonId,
        boolean shopEnabled,
        boolean bookingEnabled,
        boolean posEnabled,
        BookingPaymentType bookingPaymentType,
        int bookingDepositPercent,
        Instant updatedAt
) {
    public enum BookingPaymentType { FULL, DEPOSIT }

    public SalonPaymentSettings {
        if (bookingPaymentType == null) bookingPaymentType = BookingPaymentType.FULL;
        if (bookingDepositPercent < 1 || bookingDepositPercent > 100) bookingDepositPercent = 20;
    }
}
