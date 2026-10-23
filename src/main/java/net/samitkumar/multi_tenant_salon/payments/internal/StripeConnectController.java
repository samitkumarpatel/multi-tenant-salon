package net.samitkumar.multi_tenant_salon.payments.internal;

import net.samitkumar.multi_tenant_salon.payments.PaymentGateway;
import net.samitkumar.multi_tenant_salon.payments.SalonPaymentSettings;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/salon-admin/{salonId}/payments")
class StripeConnectController {
    record ConnectStatus(StripeConnectService.Status stripe) {}
    record UpdateSettings(List<SalonPaymentSettings.AreaSetting> areas,
                          SalonPaymentSettings.BookingPaymentType bookingPaymentType,
                          int bookingDepositPercent) {}
    record OnboardingLink(String url) {}
    record TransactionDetail(PaymentLedger.PaymentRecord payment, List<PaymentLedger.RefundRecord> refunds) {}
    record RefundBody(BigDecimal amount, String reason) {}
    record RegisterTerminal(String registrationCode, String label) {}
    record RenameTerminal(String label) {}
    record RetryTerminalPayment(Long terminalId) {}
    record SimulateCard(String cardNumber) {}

    private final StripeConnectService payments;
    private final StripeTerminalService terminals;
    private final StripeRefundService refunds;
    private final PaymentLedger ledger;
    private final SalonApi salons;

    StripeConnectController(StripeConnectService payments, StripeTerminalService terminals, StripeRefundService refunds,
                            PaymentLedger ledger, SalonApi salons) {
        this.payments = payments;
        this.terminals = terminals;
        this.refunds = refunds;
        this.ledger = ledger;
        this.salons = salons;
    }

    // ── Account ─────────────────────────────────────────────────────────────

    @GetMapping("/stripe")
    ConnectStatus status(@PathVariable String salonId) {
        return new ConnectStatus(payments.status(resolve(salonId)));
    }

    @PostMapping("/stripe/onboarding-link")
    OnboardingLink onboardingLink(@PathVariable String salonId) {
        return new OnboardingLink(payments.onboardingUrl(resolve(salonId)));
    }

    @PostMapping("/stripe/account-session")
    StripeConnectService.AccountSession accountSession(@PathVariable String salonId) {
        return payments.accountSession(resolve(salonId));
    }

    @PutMapping("/settings")
    SalonPaymentSettings update(@PathVariable String salonId, @RequestBody UpdateSettings request) {
        if (request.bookingPaymentType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking payment type is required");
        }
        return payments.update(resolve(salonId), request.areas(), request.bookingPaymentType(), request.bookingDepositPercent());
    }

    // ── Transactions & refunds ──────────────────────────────────────────────

    @GetMapping("/transactions")
    List<PaymentLedger.PaymentRecord> transactions(@PathVariable String salonId,
                                                   @RequestParam(required = false) String area,
                                                   @RequestParam(required = false) String reference,
                                                   @RequestParam(defaultValue = "100") int limit) {
        if (area != null && !SalonPaymentSettings.AREAS.contains(area)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown payment area: " + area);
        }
        // A reference (an order / payment / sale id) only means something within its area.
        if (reference != null && area == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A reference filter needs an area");
        }
        return ledger.list(resolve(salonId), area, reference, Math.clamp(limit, 1, 500));
    }

    @GetMapping("/transactions/{paymentId}")
    TransactionDetail transaction(@PathVariable String salonId, @PathVariable Long paymentId) {
        var id = resolve(salonId);
        var payment = ledger.find(id, paymentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));
        return new TransactionDetail(payment, ledger.refunds(id, paymentId));
    }

    /** Refunds (all or part of) a card payment to the customer's card; {@code amount} null refunds what's left. */
    @PostMapping("/transactions/{paymentId}/refunds")
    ResponseEntity<PaymentGateway.Refund> refund(@PathVariable String salonId, @PathVariable Long paymentId,
                                                 @RequestBody(required = false) RefundBody body,
                                                 @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        var refund = refunds.refundPayment(resolve(salonId), paymentId, body == null ? null : body.amount(),
                body == null ? null : body.reason(), jwt == null ? null : jwt.getSubject());
        return ResponseEntity.status(HttpStatus.CREATED).body(refund);
    }

    // ── Card readers (Stripe Terminal) ──────────────────────────────────────

    @GetMapping("/terminals")
    List<StripeTerminalService.TerminalView> terminals(@PathVariable String salonId,
                                                       @RequestParam(defaultValue = "false") boolean refresh) {
        var id = resolve(salonId);
        return refresh ? terminals.refresh(id) : terminals.list(id);
    }

    @PostMapping("/terminals")
    ResponseEntity<StripeTerminalService.TerminalView> registerTerminal(@PathVariable String salonId,
                                                                        @RequestBody RegisterTerminal body) {
        var salon = payments.requireSalon(resolve(salonId));
        if (salon.features().stream().noneMatch(f -> f.feature() == SalonFeature.DASHBOARD)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Card readers are used from the salon desk — enable the Dashboard feature first");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(terminals.register(salon, body.registrationCode(), body.label()));
    }

    @PutMapping("/terminals/{terminalId}")
    StripeTerminalService.TerminalView renameTerminal(@PathVariable String salonId, @PathVariable Long terminalId,
                                                      @RequestBody RenameTerminal body) {
        return terminals.rename(resolve(salonId), terminalId, body.label());
    }

    @DeleteMapping("/terminals/{terminalId}")
    ResponseEntity<Void> removeTerminal(@PathVariable String salonId, @PathVariable Long terminalId) {
        terminals.remove(resolve(salonId), terminalId);
        return ResponseEntity.noContent().build();
    }

    // ── Payments running on a reader (used by the desk) ─────────────────────

    @GetMapping("/terminal-payments/{paymentId}")
    PaymentGateway.TerminalPayment terminalPayment(@PathVariable String salonId, @PathVariable Long paymentId,
                                                   @RequestParam(defaultValue = "false") boolean refresh) {
        return terminals.status(resolve(salonId), paymentId, refresh);
    }

    @PostMapping("/terminal-payments/{paymentId}/cancel")
    PaymentGateway.TerminalPayment cancelTerminalPayment(@PathVariable String salonId, @PathVariable Long paymentId) {
        return terminals.cancel(resolve(salonId), paymentId);
    }

    @PostMapping("/terminal-payments/{paymentId}/retry")
    PaymentGateway.TerminalPayment retryTerminalPayment(@PathVariable String salonId, @PathVariable Long paymentId,
                                                        @RequestBody(required = false) RetryTerminalPayment body) {
        return terminals.retry(resolve(salonId), paymentId, body == null ? null : body.terminalId());
    }

    @PostMapping("/terminal-payments/{paymentId}/simulate")
    PaymentGateway.TerminalPayment simulateCard(@PathVariable String salonId, @PathVariable Long paymentId,
                                                @RequestBody(required = false) SimulateCard body) {
        return terminals.simulateCard(resolve(salonId), paymentId, body == null ? null : body.cardNumber());
    }

    private UUID resolve(String salonId) { return salons.resolveId(salonId); }
}
