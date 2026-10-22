package net.samitkumar.multi_tenant_salon.payments.internal;

import net.samitkumar.multi_tenant_salon.payments.PaymentGateway;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Refunds a card payment back to the customer from inside the app. The payment row is locked for the call,
 * so two refunds can't both pass the "not more than was paid" check; Stripe's later status (a refund can
 * still fail, e.g. a closed card) arrives through the {@code refund.*} webhooks.
 */
@Service
class StripeRefundService {
    private final StripeClient stripe;
    private final PaymentLedger ledger;
    private final StripeConnectedAccountRepository accounts;

    StripeRefundService(StripeClient stripe, PaymentLedger ledger, StripeConnectedAccountRepository accounts) {
        this.stripe = stripe;
        this.ledger = ledger;
        this.accounts = accounts;
    }

    @Transactional
    Optional<PaymentGateway.Refund> refundIfPaid(UUID salonId, String area, String reference, BigDecimal amount,
                                                 String reason, String requestedBy) {
        var payment = ledger.lockLatestPaid(salonId, area, reference).orElse(null);
        if (payment == null) return Optional.empty();
        return Optional.of(refund(payment, amount, reason, requestedBy));
    }

    @Transactional
    PaymentGateway.Refund refundPayment(UUID salonId, Long paymentId, BigDecimal amount, String reason, String requestedBy) {
        var payment = ledger.lock(salonId, paymentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));
        return refund(payment, amount, reason, requestedBy);
    }

    private PaymentGateway.Refund refund(PaymentLedger.PaymentRecord payment, BigDecimal amount, String reason,
                                         String requestedBy) {
        if (!payment.refundable()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "REFUNDED".equals(payment.status())
                    ? "This payment has already been refunded in full" : "Only a completed card payment can be refunded");
        }
        var remaining = payment.remaining();
        var value = amount == null ? remaining : amount.setScale(2, RoundingMode.HALF_UP);
        if (value.signum() <= 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Refund amount must be positive");
        if (value.compareTo(remaining) > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "At most " + remaining.toPlainString() + " " + payment.currency() + " can still be refunded");
        }
        var account = accounts.findById(payment.salonId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "No Stripe account connected"));
        var form = new LinkedMultiValueMap<String, String>();
        form.add("payment_intent", payment.paymentIntentId());
        form.add("amount", Long.toString(StripeAmounts.minorUnits(value, payment.currency())));
        form.add("reason", "requested_by_customer");
        form.add("metadata[salon_id]", payment.salonId().toString());
        form.add("metadata[payment_area]", payment.area());
        form.add("metadata[payment_reference]", payment.reference());
        // One refund per (payment, refunded-so-far, amount): a retried click can't refund twice.
        var key = "refund-" + payment.id() + "-" + payment.amountRefunded().toPlainString() + "-" + value.toPlainString();
        var refund = stripe.post("/v1/refunds", form, key, account.stripeAccountId());
        var saved = ledger.recordRefund(payment, (String) refund.get("id"), value,
                String.valueOf(refund.get("status")), reason, requestedBy);
        return new PaymentGateway.Refund(saved.id(), saved.paymentId(), saved.amount(), saved.currency(), saved.status());
    }

    /**
     * {@code refund.created} / {@code refund.updated} / {@code refund.failed} / {@code charge.refund.updated}. A refund
     * the owner made in Stripe's embedded payments component (not through this service) is added to the ledger here.
     */
    void onRefund(UUID salonId, Map<String, Object> refund) {
        if (!(refund.get("id") instanceof String id) || !(refund.get("status") instanceof String status)) return;
        if (ledger.findRefund(id).isPresent()) {
            ledger.updateRefundStatus(id, status);
            return;
        }
        if (!(refund.get("payment_intent") instanceof String intentId) || !(refund.get("amount") instanceof Number minor)) return;
        ledger.findByIntent(intentId).filter(p -> p.salonId().equals(salonId)).ifPresent(payment ->
                ledger.recordRefund(payment, id,
                        BigDecimal.valueOf(minor.longValue()).movePointLeft(StripeAmounts.exponent(payment.currency())),
                        status, "Refunded in Stripe", "stripe"));
    }
}
