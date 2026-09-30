package net.samitkumar.multi_tenant_salon.payments;

import java.util.UUID;

public record StripePaymentEvent(UUID salonId, String paymentArea, String reference,
                                 String checkoutSessionId, boolean succeeded) {}
