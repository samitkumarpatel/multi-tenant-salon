package net.samitkumar.multi_tenant_salon.payments;

import java.math.BigDecimal;
import java.util.UUID;

/** Public boundary for payment-enabled feature modules. */
public interface PaymentGateway {
    record BookingConfig(boolean enabled, SalonPaymentSettings.BookingPaymentType paymentType, int depositPercent) {}
    boolean enabled(UUID salonId, String area);
    void requireEnabled(UUID salonId, String area);
    String createCheckout(UUID salonId, String area, String reference, BigDecimal amount, String currency, String itemName);
    BookingConfig bookingConfig(UUID salonId);
}
