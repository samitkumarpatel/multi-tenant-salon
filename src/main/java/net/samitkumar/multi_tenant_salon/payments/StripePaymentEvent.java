package net.samitkumar.multi_tenant_salon.payments;

import java.util.UUID;

/**
 * The outcome of a payment for {@code paymentArea}/{@code reference}. {@code checkoutSessionId} is the Stripe
 * reference the feature module stores: the Checkout Session id for online checkouts, the PaymentIntent id
 * for card-reader (Terminal) payments.
 */
public record StripePaymentEvent(UUID salonId, String paymentArea, String reference,
                                 String checkoutSessionId, boolean succeeded) {}
