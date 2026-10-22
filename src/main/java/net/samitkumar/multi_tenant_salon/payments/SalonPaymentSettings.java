package net.samitkumar.multi_tenant_salon.payments;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A salon's payment set-up: one entry per payment area (whether it takes card payments and how the
 * customer pays there) plus the booking deposit options. Stored in {@code salon_payment_area} and
 * {@code salon_payment_settings}.
 */
public record SalonPaymentSettings(
        UUID salonId,
        List<AreaSetting> areas,
        BookingPaymentType bookingPaymentType,
        int bookingDepositPercent,
        Instant updatedAt
) {
    public enum BookingPaymentType { FULL, DEPOSIT }

    /** Every payment area; each one needs the salon feature next to it. */
    public static final List<String> AREAS = List.of("SHOP", "BOOKING", "POS", "MEMBERSHIP");

    public record AreaSetting(String area, boolean enabled, CheckoutUi checkoutUi) {
        public AreaSetting {
            if (checkoutUi == null) checkoutUi = CheckoutUi.REDIRECT;
        }
    }

    public SalonPaymentSettings {
        areas = areas == null ? List.of() : List.copyOf(areas);
        if (bookingPaymentType == null) bookingPaymentType = BookingPaymentType.FULL;
        if (bookingDepositPercent < 1 || bookingDepositPercent > 100) bookingDepositPercent = 20;
    }

    public AreaSetting area(String area) {
        return areas.stream().filter(a -> a.area().equals(area)).findFirst()
                .orElse(new AreaSetting(area, false, CheckoutUi.REDIRECT));
    }
}
