package net.samitkumar.multi_tenant_salon.payments;

import java.math.BigDecimal;
import java.util.UUID;

/** Public boundary for payment-enabled feature modules. */
public interface PaymentGateway {
    record BookingConfig(boolean enabled, SalonPaymentSettings.BookingPaymentType paymentType, int depositPercent) {}
    boolean enabled(UUID salonId, String area);
    void requireEnabled(UUID salonId, String area);

    default String createCheckout(UUID salonId, String area, String reference, BigDecimal amount, String currency, String itemName) {
        return createCheckout(salonId, area, reference, amount, currency, itemName, null);
    }

    /**
     * Creates a connected-account Checkout Session. {@code returnUrl} is the page the customer started
     * from; it is honoured only when it belongs to the salon (included subdomain, its active custom
     * domain, or a configured platform app), otherwise the area's default return page is used.
     */
    String createCheckout(UUID salonId, String area, String reference, BigDecimal amount, String currency,
                          String itemName, String returnUrl);
    BookingConfig bookingConfig(UUID salonId);
}
