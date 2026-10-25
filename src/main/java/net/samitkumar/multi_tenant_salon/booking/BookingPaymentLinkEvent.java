package net.samitkumar.multi_tenant_salon.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Published when the salon sends a customer a link to pay for an appointment after the fact — typically
 * one they did not turn up to. {@code paymentUrl} is a one-time Stripe Checkout page, which Stripe keeps
 * open for 24 hours; the salon can send a fresh one at any time.
 */
public record BookingPaymentLinkEvent(
        Long bookingId,
        UUID salonId,
        String customerName,
        String customerEmail,
        LocalDate appointmentDate,
        LocalTime startTime,
        String serviceName,
        BigDecimal amount,
        String currency,
        String paymentUrl,
        String salonName,
        String salonPhone,
        String salonEmail
) {}
