package net.samitkumar.multi_tenant_salon.payments.internal;

import net.samitkumar.multi_tenant_salon.payments.PaymentGateway;
import net.samitkumar.multi_tenant_salon.payments.StripeConnectedAccount;
import net.samitkumar.multi_tenant_salon.payments.StripePaymentEvent;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Stripe Terminal, server-driven: the salon registers card readers here (no Stripe Dashboard), and the desk
 * sends a card-present PaymentIntent to the reader it picks. The outcome reaches the feature module as the same
 * {@link StripePaymentEvent} a checkout produces — from the {@code payment_intent.*} webhooks, from the desk's
 * status check when a webhook is late, or from a cancel at the desk; the ledger's conditional update makes sure
 * exactly one of them reports it. A declined card leaves the payment open (Stripe's advice: reuse the
 * PaymentIntent) so the customer can try another card.
 */
@Service
class StripeTerminalService {

    record TerminalView(Long id, String stripeReaderId, String label, String deviceType, String serialNumber,
                        String status, Instant createdAt) {}

    /** How long a pending payment trusts its stored state before the status check asks Stripe again. */
    private static final Duration STATUS_RECHECK = Duration.ofSeconds(10);

    private final StripeClient stripe;
    private final PaymentLedger ledger;
    private final StripeConnectedAccountRepository accounts;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate tx;
    private final JdbcClient jdbc;

    StripeTerminalService(StripeClient stripe, PaymentLedger ledger, StripeConnectedAccountRepository accounts,
                          ApplicationEventPublisher events, TransactionTemplate tx, JdbcTemplate jdbcTemplate) {
        this.stripe = stripe;
        this.ledger = ledger;
        this.accounts = accounts;
        this.events = events;
        this.tx = tx;
        this.jdbc = JdbcClient.create(jdbcTemplate);
    }

    // ── Readers ─────────────────────────────────────────────────────────────

    List<TerminalView> list(UUID salonId) {
        return jdbc.sql("SELECT id, stripe_reader_id, label, device_type, serial_number, status, created_at FROM payment_terminal"
                        + " WHERE salon_id = :salon ORDER BY label, id")
                .param("salon", salonId).query(StripeTerminalService::terminal).list();
    }

    /** Re-reads every reader's online status from Stripe (best effort: Stripe being unreachable keeps the stored one). */
    List<TerminalView> refresh(UUID salonId) {
        var account = accounts.findById(salonId).orElse(null);
        if (account == null || !stripe.secretConfigured()) return list(salonId);
        for (var terminal : list(salonId)) {
            try {
                var reader = stripe.get("/v1/terminal/readers/" + terminal.stripeReaderId(), account.stripeAccountId());
                if (Boolean.TRUE.equals(reader.get("deleted"))) {
                    jdbc.sql("DELETE FROM payment_terminal WHERE id = :id").param("id", terminal.id()).update();
                } else {
                    saveReader(salonId, reader, null);
                }
            } catch (ResponseStatusException ignored) {
                // Keep the last known status; the desk can still try the reader.
            }
        }
        return list(salonId);
    }

    /** Registers a reader by the code it shows on screen ({@code simulated-wpe} gives a simulated reader in test mode). */
    TerminalView register(Salon salon, String registrationCode, String label) {
        if (registrationCode == null || registrationCode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter the registration code shown on the reader");
        }
        var account = requireAccount(salon.id());
        var location = ensureLocation(salon, account);
        var form = new LinkedMultiValueMap<String, String>();
        form.add("registration_code", registrationCode.strip());
        form.add("location", location);
        if (label != null && !label.isBlank()) form.add("label", label.strip());
        form.add("metadata[salon_id]", salon.id().toString());
        var reader = stripe.post("/v1/terminal/readers", form, null, account.stripeAccountId());
        return saveReader(salon.id(), reader, label);
    }

    TerminalView rename(UUID salonId, Long terminalId, String label) {
        if (label == null || label.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A name is required");
        var terminal = requireTerminal(salonId, terminalId);
        var account = requireAccount(salonId);
        var form = new LinkedMultiValueMap<String, String>();
        form.add("label", label.strip());
        var reader = stripe.post("/v1/terminal/readers/" + terminal.stripeReaderId(), form, null, account.stripeAccountId());
        return saveReader(salonId, reader, label.strip());
    }

    void remove(UUID salonId, Long terminalId) {
        var terminal = requireTerminal(salonId, terminalId);
        var account = requireAccount(salonId);
        try {
            stripe.delete("/v1/terminal/readers/" + terminal.stripeReaderId(), account.stripeAccountId());
        } catch (ResponseStatusException e) {
            // Already gone at Stripe (e.g. removed there): still forget it here.
            if (!"resource_missing".equals(StripeClient.errorCode(e))) throw e;
        }
        jdbc.sql("DELETE FROM payment_terminal WHERE id = :id AND salon_id = :salon")
                .param("id", terminalId).param("salon", salonId).update();
    }

    /** The salon's Terminal Location, created once from the salon's address on its connected account. */
    private String ensureLocation(Salon salon, StripeConnectedAccount account) {
        var existing = jdbc.sql("SELECT stripe_location_id FROM payment_terminal_location WHERE salon_id = :salon")
                .param("salon", salon.id()).query(String.class).optional();
        if (existing.isPresent()) return existing.get();
        var address = salon.location();
        if (address == null || blank(address.address()) || blank(address.city()) || blank(address.zipCode())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Add the salon's street address, city and postal code before registering a card reader");
        }
        var form = new LinkedMultiValueMap<String, String>();
        form.add("display_name", salon.name() == null || salon.name().isBlank() ? "Salon" : salon.name());
        form.add("address[line1]", address.address().strip());
        form.add("address[city]", address.city().strip());
        if (!blank(address.state())) form.add("address[state]", address.state().strip());
        form.add("address[postal_code]", address.zipCode().strip());
        form.add("address[country]", account.country().toUpperCase(Locale.ROOT));
        form.add("metadata[salon_id]", salon.id().toString());
        var location = stripe.post("/v1/terminal/locations", form, "terminal-location-" + salon.id(), account.stripeAccountId());
        var id = (String) location.get("id");
        jdbc.sql("INSERT INTO payment_terminal_location (salon_id, stripe_location_id, created_at) VALUES (:salon, :location, :now)"
                        + " ON CONFLICT (salon_id) DO NOTHING")
                .param("salon", salon.id()).param("location", id).param("now", ts(Instant.now())).update();
        return jdbc.sql("SELECT stripe_location_id FROM payment_terminal_location WHERE salon_id = :salon")
                .param("salon", salon.id()).query(String.class).single();
    }

    private TerminalView saveReader(UUID salonId, Map<String, Object> reader, String fallbackLabel) {
        var readerId = (String) reader.get("id");
        var label = reader.get("label") instanceof String l && !l.isBlank() ? l
                : fallbackLabel == null || fallbackLabel.isBlank() ? "Card reader" : fallbackLabel.strip();
        var now = ts(Instant.now());
        jdbc.sql("""
                INSERT INTO payment_terminal (salon_id, stripe_reader_id, label, device_type, serial_number, status, created_at, updated_at)
                VALUES (:salon, :reader, :label, :device, :serial, :status, :now, :now)
                ON CONFLICT (stripe_reader_id) DO UPDATE SET label = EXCLUDED.label, device_type = EXCLUDED.device_type,
                    serial_number = EXCLUDED.serial_number, status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
                WHERE payment_terminal.salon_id = EXCLUDED.salon_id
                """)
                .param("salon", salonId).param("reader", readerId).param("label", label)
                .param("device", reader.get("device_type")).param("serial", reader.get("serial_number"))
                .param("status", reader.get("status")).param("now", now).update();
        return jdbc.sql("SELECT id, stripe_reader_id, label, device_type, serial_number, status, created_at FROM payment_terminal"
                        + " WHERE stripe_reader_id = :reader AND salon_id = :salon")
                .param("reader", readerId).param("salon", salonId).query(StripeTerminalService::terminal).optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "That reader belongs to another salon"));
    }

    private TerminalView requireTerminal(UUID salonId, Long terminalId) {
        if (terminalId == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a card reader");
        return jdbc.sql("SELECT id, stripe_reader_id, label, device_type, serial_number, status, created_at FROM payment_terminal"
                        + " WHERE id = :id AND salon_id = :salon")
                .param("id", terminalId).param("salon", salonId).query(StripeTerminalService::terminal).optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Card reader not found"));
    }

    // ── Payments on a reader ────────────────────────────────────────────────

    PaymentGateway.TerminalPayment collect(UUID salonId, String area, String reference, BigDecimal amount, String currency,
                                           String description, Long terminalId) {
        var terminal = requireTerminal(salonId, terminalId);
        var account = requireAccount(salonId);
        var form = new LinkedMultiValueMap<String, String>();
        form.add("amount", Long.toString(StripeAmounts.minorUnits(amount, currency)));
        form.add("currency", currency.toLowerCase(Locale.ROOT));
        form.add("allowed_payment_method_types[]", "card_present");
        form.add("capture_method", "automatic");
        if (description != null && !description.isBlank()) form.add("description", description);
        form.add("metadata[salon_id]", salonId.toString());
        form.add("metadata[payment_area]", area);
        form.add("metadata[payment_reference]", reference);
        form.add("metadata[payment_channel]", PaymentLedger.Channel.TERMINAL.name());
        var intent = stripe.post("/v1/payment_intents", form,
                "terminal-" + area.toLowerCase(Locale.ROOT) + "-" + reference, account.stripeAccountId());
        var payment = ledger.recordTerminal(salonId, area, reference, amount, currency, description,
                (String) intent.get("id"), terminal.id());
        process(account, payment, terminal);
        return view(ledger.find(salonId, payment.id()).orElseThrow());
    }

    /** Sends the open payment to a reader again (after a decline, or to a different reader). */
    PaymentGateway.TerminalPayment retry(UUID salonId, Long paymentId, Long terminalId) {
        var payment = requirePending(salonId, paymentId);
        var terminal = requireTerminal(salonId, terminalId == null ? payment.terminalId() : terminalId);
        ledger.retarget(payment.id(), terminal.id());
        process(requireAccount(salonId), payment, terminal);
        return view(ledger.find(salonId, paymentId).orElseThrow());
    }

    private void process(StripeConnectedAccount account, PaymentLedger.PaymentRecord payment, TerminalView terminal) {
        var form = new LinkedMultiValueMap<String, String>();
        form.add("payment_intent", payment.paymentIntentId());
        try {
            stripe.post("/v1/terminal/readers/" + terminal.stripeReaderId() + "/process_payment_intent", form, null,
                    account.stripeAccountId());
        } catch (ResponseStatusException e) {
            // Reader offline/busy: the payment stays open so the desk can retry or cancel it.
            ledger.noteFailure(payment.id(), readerProblem(StripeClient.errorCode(e), e.getReason()));
        }
    }

    PaymentGateway.TerminalPayment status(UUID salonId, Long paymentId, boolean recheck) {
        var payment = ledger.find(salonId, paymentId)
                .filter(p -> p.channel() == PaymentLedger.Channel.TERMINAL)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));
        boolean stale = payment.updatedAt() == null || payment.updatedAt().isBefore(Instant.now().minus(STATUS_RECHECK));
        if (payment.pending() && (recheck || stale) && stripe.secretConfigured()) {
            reconcile(payment);
            payment = ledger.find(salonId, paymentId).orElseThrow();
        }
        return view(payment);
    }

    /** Fallback for a late webhook: asks Stripe where the PaymentIntent and the reader action are. */
    private void reconcile(PaymentLedger.PaymentRecord payment) {
        var account = accounts.findById(payment.salonId()).orElse(null);
        if (account == null) return;
        try {
            var intent = stripe.get("/v1/payment_intents/" + payment.paymentIntentId(), account.stripeAccountId());
            if (intent == null) return;
            switch (String.valueOf(intent.get("status"))) {
                case "succeeded" -> settle(payment, "SUCCEEDED", null);
                case "canceled" -> settle(payment, "CANCELED", "Payment canceled");
                default -> {
                    var terminal = payment.terminalId() == null ? null
                            : list(payment.salonId()).stream().filter(t -> t.id().equals(payment.terminalId())).findFirst().orElse(null);
                    if (terminal == null) return;
                    var reader = stripe.get("/v1/terminal/readers/" + terminal.stripeReaderId(), account.stripeAccountId());
                    if (reader != null && reader.get("action") instanceof Map<?, ?> action && "failed".equals(action.get("status"))
                            && action.get("process_payment_intent") instanceof Map<?, ?> processed
                            && payment.paymentIntentId().equals(processed.get("payment_intent"))) {
                        ledger.noteFailure(payment.id(), readerProblem((String) action.get("failure_code"), (String) action.get("failure_message")));
                    }
                }
            }
        } catch (ResponseStatusException ignored) {
            // Stripe unreachable: keep waiting for the webhook.
        }
    }

    /** Stops the payment on the reader and cancels it; the feature module hears it failed. */
    PaymentGateway.TerminalPayment cancel(UUID salonId, Long paymentId) {
        var payment = requirePending(salonId, paymentId);
        var account = requireAccount(salonId);
        if (payment.terminalId() != null) {
            var terminal = list(salonId).stream().filter(t -> t.id().equals(payment.terminalId())).findFirst().orElse(null);
            if (terminal != null) {
                try {
                    stripe.post("/v1/terminal/readers/" + terminal.stripeReaderId() + "/cancel_action",
                            new LinkedMultiValueMap<>(), null, account.stripeAccountId());
                } catch (ResponseStatusException e) {
                    if ("terminal_reader_busy".equals(StripeClient.errorCode(e))) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                "The card is being processed right now — wait a moment, then check the status");
                    }
                    // Nothing running on the reader (or it is offline): cancelling the PaymentIntent is enough.
                }
            }
        }
        var form = new LinkedMultiValueMap<String, String>();
        form.add("cancellation_reason", "requested_by_customer");
        try {
            stripe.post("/v1/payment_intents/" + payment.paymentIntentId() + "/cancel", form, null, account.stripeAccountId());
            settle(payment, "CANCELED", "Canceled at the desk");
        } catch (ResponseStatusException e) {
            // Too late to cancel: it may have just gone through.
            reconcile(payment);
            var latest = ledger.find(salonId, paymentId).orElseThrow();
            if (latest.pending()) throw e;
        }
        return view(ledger.find(salonId, paymentId).orElseThrow());
    }

    /** Test mode only: makes a simulated reader "tap" a test card, so the whole flow can be tried without hardware. */
    PaymentGateway.TerminalPayment simulateCard(UUID salonId, Long paymentId, String testCardNumber) {
        if (!stripe.testMode()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Card simulation is only available in Stripe test mode");
        var payment = requirePending(salonId, paymentId);
        var terminal = requireTerminal(salonId, payment.terminalId());
        var form = new LinkedMultiValueMap<String, String>();
        if (testCardNumber != null && !testCardNumber.isBlank()) {
            form.add("type", "card_present");
            form.add("card_present[number]", testCardNumber.replaceAll("\\s", ""));
        }
        stripe.post("/v1/test_helpers/terminal/readers/" + terminal.stripeReaderId() + "/present_payment_method", form, null,
                requireAccount(salonId).stripeAccountId());
        return status(salonId, paymentId, true);
    }

    // ── Webhooks ────────────────────────────────────────────────────────────

    /** {@code payment_intent.*} for a PaymentIntent this service created (metadata {@code payment_channel=TERMINAL}). */
    void onPaymentIntent(UUID salonId, String type, Map<String, Object> intent) {
        var payment = ledger.findByIntent(String.valueOf(intent.get("id")))
                .filter(p -> p.salonId().equals(salonId) && p.channel() == PaymentLedger.Channel.TERMINAL).orElse(null);
        if (payment == null || !payment.pending()) return;
        switch (type) {
            case "payment_intent.succeeded" -> settle(payment, "SUCCEEDED", null);
            case "payment_intent.canceled" -> settle(payment, "CANCELED", "Payment canceled");
            case "payment_intent.payment_failed" -> {
                var error = intent.get("last_payment_error") instanceof Map<?, ?> e ? e : Map.of();
                ledger.noteFailure(payment.id(), readerProblem((String) error.get("code"), (String) error.get("message")));
            }
            default -> { }
        }
    }

    /** {@code terminal.reader.action_failed}: e.g. a declined card or a timeout — kept open for another try. */
    void onReaderActionFailed(Map<String, Object> reader) {
        if (!(reader.get("action") instanceof Map<?, ?> action)
                || !(action.get("process_payment_intent") instanceof Map<?, ?> processed)
                || !(processed.get("payment_intent") instanceof String intentId)) return;
        ledger.findByIntent(intentId).filter(PaymentLedger.PaymentRecord::pending).ifPresent(payment ->
                ledger.noteFailure(payment.id(), readerProblem((String) action.get("failure_code"), (String) action.get("failure_message"))));
    }

    /** Settles once and tells the feature module, in one transaction so the event is stored with the change. */
    private void settle(PaymentLedger.PaymentRecord payment, String status, String failureMessage) {
        tx.executeWithoutResult(s -> {
            if (ledger.settle(payment.id(), status, payment.paymentIntentId(), failureMessage)) {
                events.publishEvent(new StripePaymentEvent(payment.salonId(), payment.area(), payment.reference(),
                        payment.paymentIntentId(), "SUCCEEDED".equals(status)));
            }
        });
    }

    private PaymentLedger.PaymentRecord requirePending(UUID salonId, Long paymentId) {
        var payment = ledger.find(salonId, paymentId)
                .filter(p -> p.channel() == PaymentLedger.Channel.TERMINAL)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));
        if (!payment.pending()) throw new ResponseStatusException(HttpStatus.CONFLICT, "This payment is already " + payment.status().toLowerCase(Locale.ROOT));
        return payment;
    }

    private StripeConnectedAccount requireAccount(UUID salonId) {
        return accounts.findById(salonId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.CONFLICT, "Connect a Stripe account before adding card readers"));
    }

    PaymentGateway.TerminalPayment view(PaymentLedger.PaymentRecord payment) {
        var label = payment.terminalId() == null ? null : jdbc.sql("SELECT label FROM payment_terminal WHERE id = :id")
                .param("id", payment.terminalId()).query(String.class).optional().orElse(null);
        return new PaymentGateway.TerminalPayment(payment.id(), payment.status(), payment.terminalId(), label,
                payment.amount(), payment.currency(), payment.failureMessage());
    }

    /** A short reason the desk can act on. */
    static String readerProblem(String code, String message) {
        if (code == null) return message == null || message.isBlank() ? "The reader couldn't take the payment" : message;
        return switch (code) {
            case "card_declined" -> "Card declined" + (message == null || message.isBlank() ? "" : " — " + message);
            case "terminal_reader_offline" -> "The reader is offline — check its power and network, then try again";
            case "terminal_reader_busy" -> "The reader is busy with another payment";
            case "terminal_reader_timeout" -> "The reader didn't respond in time — try again";
            case "customer_canceled" -> "The customer canceled on the reader";
            default -> message == null || message.isBlank() ? code : message;
        };
    }

    private static TerminalView terminal(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        var created = rs.getObject("created_at", OffsetDateTime.class);
        return new TerminalView(rs.getLong("id"), rs.getString("stripe_reader_id"), rs.getString("label"),
                rs.getString("device_type"), rs.getString("serial_number"), rs.getString("status"),
                created == null ? null : created.toInstant());
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }

    private static OffsetDateTime ts(Instant instant) { return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC); }
}
