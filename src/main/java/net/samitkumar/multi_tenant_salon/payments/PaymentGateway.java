package net.samitkumar.multi_tenant_salon.payments;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

/** Public boundary for payment-enabled feature modules. */
public interface PaymentGateway {
    record BookingConfig(boolean enabled, SalonPaymentSettings.BookingPaymentType paymentType, int depositPercent) {}

    /**
     * What a feature module asks the customer to pay for. {@code returnUrl} is the page the customer started
     * from; it is honoured only when it belongs to the salon (included subdomain, its active custom domain, or
     * a configured platform app), otherwise the area's default return page is used. {@code inlineCheckout} says
     * the client can render Stripe's form itself (the salon website, booking app, desk); without it — MCP apps,
     * the chat, older clients — the checkout is always a redirect, whatever the salon chose.
     */
    record CheckoutRequest(String area, String reference, BigDecimal amount, String currency, String itemName,
                           String returnUrl, String customerEmail, boolean inlineCheckout) {}

    /**
     * How to take the customer through payment. {@code REDIRECT}: open {@code url}. {@code EMBEDDED} /
     * {@code ELEMENTS}: load Stripe.js with {@code publishableKey} on {@code stripeAccountId} and mount the form
     * from {@code clientSecret}; Stripe then sends the customer to {@code returnUrl}, and leaving the form
     * goes to {@code cancelUrl} — the same pages the redirect checkout returns to.
     */
    record Checkout(CheckoutUi ui, String url, String clientSecret, String publishableKey, String stripeAccountId,
                    String returnUrl, String cancelUrl, Branding branding) {}

    /** The salon's look, taken from its website theme, for styling the payment form. */
    record Branding(String displayName, String primaryColor, String backgroundColor, String fontFamily) {}

    /** A card payment running on a Stripe Terminal reader at the salon. */
    record TerminalPayment(Long paymentId, String status, Long terminalId, String terminalLabel,
                           BigDecimal amount, String currency, String failureMessage) {}

    record Refund(Long id, Long paymentId, BigDecimal amount, String currency, String status) {}

    boolean enabled(UUID salonId, String area);
    void requireEnabled(UUID salonId, String area);

    /** Starts a one-time Checkout Session on the salon's connected account, recorded in the payment ledger. */
    Checkout createCheckout(UUID salonId, CheckoutRequest request);

    /**
     * Sends a payment to one of the salon's card readers. The outcome arrives later as a
     * {@link StripePaymentEvent} for {@code area}/{@code reference}, exactly like a checkout.
     */
    TerminalPayment collectOnTerminal(UUID salonId, String area, String reference, BigDecimal amount,
                                      String currency, String description, Long terminalId);

    /**
     * Refunds the card payment taken for {@code area}/{@code reference} ({@code amount} null = everything not
     * yet refunded). Empty when nothing was paid by card for it (e.g. cash, or not paid yet).
     */
    Optional<Refund> refundIfPaid(UUID salonId, String area, String reference, BigDecimal amount,
                                  String reason, String requestedBy);

    BookingConfig bookingConfig(UUID salonId);
}
