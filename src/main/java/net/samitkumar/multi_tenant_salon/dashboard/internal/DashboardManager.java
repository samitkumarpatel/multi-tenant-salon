package net.samitkumar.multi_tenant_salon.dashboard.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.booking.Booking;
import net.samitkumar.multi_tenant_salon.booking.BookingApi;
import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import net.samitkumar.multi_tenant_salon.dashboard.DashboardApi;
import net.samitkumar.multi_tenant_salon.membership.MembershipApi;
import net.samitkumar.multi_tenant_salon.dashboard.DashboardSettings;
import net.samitkumar.multi_tenant_salon.dashboard.PosSale;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.shop.ShopCatalogApi;
import net.samitkumar.multi_tenant_salon.payments.PaymentGateway;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.math.BigDecimal;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.beans.factory.annotation.Value;

import java.time.Instant;
import java.util.Map;
import java.time.OffsetDateTime;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Slf4j
class DashboardManager implements DashboardApi {
    /** One line of the day's takings: how many sales, and how much, in one currency paid one way. */
    record MethodTotal(String currency, String method, long count, BigDecimal total) {}
    /** What one person rang up (and, for memberships, sold) that day. */
    record PersonTotal(String person, String currency, long count, BigDecimal total) {}
    record Reversed(String currency, long count, BigDecimal total) {}
    /**
     * The end-of-day sheet. {@code takings} is till sales plus memberships sold at the desk, so cash
     * reconciles against the drawer; {@code refunded} is money handed back that day, shown apart rather
     * than netted away so a refund on day two never rewrites day one.
     */
    record DailyReport(java.time.LocalDate date, String zone, List<MethodTotal> takings, List<MethodTotal> refunded,
                       List<PersonTotal> byPerson, List<Reversed> voided, long awaitingPayment) {}
    record CardCheckout(PosSale sale, PaymentGateway.Checkout checkout) {}
    record TerminalCheckout(PosSale sale, PaymentGateway.TerminalPayment terminalPayment) {}
    record CashierItem(PosSale.SourceType sourceType, Long sourceId, String name, String detail,
                       BigDecimal price, String currency, Integer availableQuantity) {}
    record SaleItemRequest(PosSale.SourceType sourceType, Long sourceId, int quantity) {}

    private final DashboardSettingsRepository settingsRepository;
    private final PosSaleRepository saleRepository;
    private final SalonApi salonApi;
    private final SalonServiceApi serviceApi;
    private final ShopCatalogApi shopApi;
    private final PaymentGateway stripe;
    private final JdbcClient jdbc;
    private final TransactionTemplate tx;
    /** Provider: a module-scoped test context may leave booking out; then the till just has no appointments. */
    private final ObjectProvider<BookingApi> bookings;
    private final ObjectProvider<MembershipApi> memberships;
    /** How long a card sale may sit unpaid before the sweeper releases its stock. */
    private final Duration staleCardSaleAfter;

    DashboardManager(DashboardSettingsRepository settingsRepository, PosSaleRepository saleRepository,
                     SalonApi salonApi, SalonServiceApi serviceApi, ShopCatalogApi shopApi,
                     PaymentGateway stripe, JdbcTemplate jdbcTemplate, TransactionTemplate tx,
                     ObjectProvider<BookingApi> bookings, ObjectProvider<MembershipApi> memberships,
                     @Value("${spring.application.dashboard.stale-card-sale-after:PT30M}") Duration staleCardSaleAfter) {
        this.settingsRepository = settingsRepository;
        this.saleRepository = saleRepository;
        this.salonApi = salonApi;
        this.serviceApi = serviceApi;
        this.shopApi = shopApi;
        this.stripe = stripe;
        this.jdbc = JdbcClient.create(jdbcTemplate);
        this.tx = tx;
        this.bookings = bookings;
        this.memberships = memberships;
        this.staleCardSaleAfter = staleCardSaleAfter;
    }

    DashboardSettings settings(UUID salonId) {
        requireDashboard(salonId);
        return settingsRepository.findById(salonId).orElseGet(() -> defaults(salonId));
    }

    /**
     * Unlike {@link #settings}, this answers for any salon — a salon without the DASHBOARD feature
     * simply has no desk capabilities, which is a legitimate answer rather than a 403.
     */
    @Override
    public Capabilities capabilities(UUID salonId) {
        var salon = salonApi.findById(salonId).orElse(null);
        if (salon == null || !hasFeature(salon, SalonFeature.DASHBOARD)) return Capabilities.NONE;
        var settings = settingsRepository.findById(salonId).orElseGet(() -> defaults(salonId));
        return new Capabilities(true, settings.bookingManagementEnabled(), settings.cashierEnabled());
    }

    DashboardSettings updateSettings(UUID salonId, boolean bookingManagement, boolean cashier) {
        var salon = requireDashboard(salonId);
        if (bookingManagement && !hasFeature(salon, SalonFeature.BOOKING)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Enable Online Booking before enabling booking management");
        }
        var saved = new DashboardSettings(salonId, bookingManagement, cashier, Instant.now());
        // Upsert rather than settingsRepository.save(): the id (salon_id) is assigned, not generated,
        // so Spring Data JDBC treats the record as existing and issues an UPDATE — which silently
        // matches no row until one has been inserted, and nothing else ever inserts it.
        jdbc.sql("""
                INSERT INTO dashboard_settings (salon_id, booking_management_enabled, cashier_enabled, updated_at)
                VALUES (:id, :booking, :cashier, :updated)
                ON CONFLICT (salon_id) DO UPDATE SET
                    booking_management_enabled = EXCLUDED.booking_management_enabled,
                    cashier_enabled = EXCLUDED.cashier_enabled,
                    updated_at = EXCLUDED.updated_at
                """)
                .param("id", salonId).param("booking", saved.bookingManagementEnabled())
                .param("cashier", saved.cashierEnabled())
                .param("updated", saved.updatedAt().atOffset(ZoneOffset.UTC))
                .update();
        return saved;
    }

    List<CashierItem> cashierItems(UUID salonId) {
        var salon = requireDashboard(salonId);
        if (!settings(salonId).cashierEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cashier is disabled");
        }
        var items = new ArrayList<CashierItem>();
        serviceApi.findAllBySalonId(salonId).stream().filter(s -> s.active() && s.price() != null).forEach(s ->
                items.add(new CashierItem(PosSale.SourceType.SERVICE, s.id(), s.name(), "Service",
                        s.price(), s.currency() == null ? "USD" : s.currency(), null)));
        if (hasFeature(salon, SalonFeature.WEBSHOP)) {
            shopApi.findAvailableItems(salonId).forEach(p -> items.add(new CashierItem(
                    PosSale.SourceType.PRODUCT, p.variantId(), p.name(), p.variantLabel(), p.price(),
                    p.currency(), p.quantityOnHand())));
        }
        return items;
    }

    @Transactional
    PosSale createSale(UUID salonId, String customerName, PosSale.PaymentMethod paymentMethod,
                       List<SaleItemRequest> requestedItems, String idempotencyKey, String actor) {
        // A retried request (lost response, flaky salon wifi) must return the sale it already made
        // rather than ring the cart up a second time.
        var replayed = replayOf(salonId, idempotencyKey);
        if (replayed != null) {
            // Same cart, different payment method (the first reply was lost, then the operator switched
            // from cash to card): handing back the earlier sale would hide that it was already rung up.
            if (replayed.paymentMethod() != paymentMethod) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "This sale was already rung up as "
                        + replayed.paymentMethod().name().toLowerCase(Locale.ROOT) + " — check Recent sales.");
            }
            return replayed;
        }
        requireDashboard(salonId);
        if (!settings(salonId).cashierEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cashier is disabled");
        }
        if (paymentMethod == null || requestedItems == null || requestedItems.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment method and at least one item are required");
        }

        var lines = new ArrayList<PosSale.Line>();
        String currency = null;
        BigDecimal total = BigDecimal.ZERO;
        for (var requested : requestedItems) {
            if (requested == null || requested.sourceType() == null || requested.sourceId() == null || requested.quantity() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid sale item");
            }
            String name;
            BigDecimal price;
            String itemCurrency;
            if (requested.sourceType() == PosSale.SourceType.BOOKING) {
                if (requested.quantity() != 1) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "An appointment is paid for once");
                }
                var booking = payableBooking(salonId, requested.sourceId());
                var service = serviceApi.findByIdAndSalonId(booking.serviceId(), salonId)
                        .filter(s -> s.price() != null)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                                "This appointment's service no longer has a price — add it as a service instead."));
                name = service.name();
                price = service.price();
                itemCurrency = service.currency() == null ? "USD" : service.currency();
            } else if (requested.sourceType() == PosSale.SourceType.SERVICE) {
                var service = serviceApi.findByIdAndSalonId(requested.sourceId(), salonId)
                        .filter(s -> s.active() && s.price() != null)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));
                name = service.name();
                price = service.price();
                itemCurrency = service.currency() == null ? "USD" : service.currency();
            } else {
                var product = shopApi.findAvailableItem(salonId, requested.sourceId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
                name = product.variantLabel() == null || product.variantLabel().isBlank()
                        ? product.name() : product.name() + " · " + product.variantLabel();
                price = product.price();
                itemCurrency = product.currency();
                shopApi.decrementStock(salonId, requested.sourceId(), requested.quantity());
            }
            if (currency == null) currency = itemCurrency.toUpperCase(Locale.ROOT);
            if (!currency.equalsIgnoreCase(itemCurrency)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "All sale items must use the same currency");
            }
            var lineTotal = price.multiply(BigDecimal.valueOf(requested.quantity()));
            total = total.add(lineTotal);
            lines.add(new PosSale.Line(null, requested.sourceType(), requested.sourceId(), name,
                    price, requested.quantity(), lineTotal));
        }
        var saleNumber = "POS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        var sale = saleRepository.save(PosSale.rungUp(salonId, saleNumber, trimToNull(customerName),
                paymentMethod, total, currency == null ? "USD" : currency, Instant.now(), "PAID",
                trimToNull(idempotencyKey), trimToNull(actor), lines));
        // Cash and "other" are settled the moment they're rung up, so any appointment on the sale is
        // paid now. A card sale is re-saved as PENDING by pendingCardSale and settles via the webhook.
        if (paymentMethod != PosSale.PaymentMethod.CARD) markBookingsPaid(salonId, sale);
        return sale;
    }

    /** The sale this idempotency key already produced, or {@code null} if it is a new cart. */
    private PosSale replayOf(UUID salonId, String idempotencyKey) {
        var key = trimToNull(idempotencyKey);
        if (key == null) return null;
        return jdbc.sql("SELECT id FROM pos_sale WHERE salon_id = :salon AND idempotency_key = :key")
                .param("salon", salonId).param("key", key)
                .query(Long.class).optional()
                .flatMap(saleRepository::findById)
                .orElse(null);
    }

    /**
     * Reverses a sale rung up wrong: stock goes back, any appointment on it is owed again, and a card
     * sale's money is returned through the same gateway the shop and memberships use. Cash is handed
     * back at the counter, so for those this records what the operator did.
     *
     * <p>{@code voided_at} is claimed with a conditional UPDATE, so a double-tap can't credit stock twice.
     */
    @Transactional
    PosSale voidSale(UUID salonId, Long saleId, String reason, String actor) {
        requireDashboard(salonId);
        if (!settings(salonId).cashierEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cashier is disabled");
        }
        var sale = saleRepository.findById(saleId).filter(s -> s.salonId().equals(salonId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sale not found"));
        if ("PENDING".equals(sale.paymentStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This sale is still waiting for its card payment — cancel the payment instead.");
        }

        int claimed = jdbc.sql("""
                        UPDATE pos_sale SET voided_at = :at, void_reason = :reason, voided_by = :by
                        WHERE id = :id AND salon_id = :salon AND voided_at IS NULL""")
                .param("at", OffsetDateTime.now(ZoneOffset.UTC)).param("reason", trimToNull(reason))
                .param("by", trimToNull(actor))
                .param("id", saleId).param("salon", salonId)
                .update();
        if (claimed != 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This sale has already been voided");
        }

        sale.lines().stream().filter(line -> line.sourceType() == PosSale.SourceType.PRODUCT)
                .forEach(line -> shopApi.incrementStock(salonId, line.sourceId(), line.quantity()));
        unmarkBookingsPaid(salonId, sale);

        // Only a settled card sale has money at Stripe to send back.
        BigDecimal refunded = null;
        if (sale.paymentMethod() == PosSale.PaymentMethod.CARD && "PAID".equals(sale.paymentStatus())) {
            refunded = stripe.refundIfPaid(salonId, "POS", String.valueOf(saleId), sale.total(),
                            trimToNull(reason), actor == null ? "desk" : actor)
                    .map(PaymentGateway.Refund::amount)
                    .orElse(null);
        }
        if (refunded != null) {
            jdbc.sql("UPDATE pos_sale SET refunded_amount = :amount WHERE id = :id AND salon_id = :salon")
                    .param("amount", refunded).param("id", saleId).param("salon", salonId).update();
        }
        log.info("[DashboardManager] Voided sale id={} salon={} method={} refunded={}",
                saleId, salonId, sale.paymentMethod(), refunded);
        return saleRepository.findById(saleId).orElseThrow();
    }

    /** Puts appointments on a voided sale back on the hook, so the desk can charge for them again. */
    private void unmarkBookingsPaid(UUID salonId, PosSale sale) {
        var api = bookings.getIfAvailable();
        if (api == null) return;
        sale.lines().stream()
                .filter(line -> line.sourceType() == PosSale.SourceType.BOOKING)
                .forEach(line -> api.clearDeskPayment(salonId, line.sourceId(), sale.saleNumber()));
    }

    /** The appointment behind a till line, if the desk may still take money for it. */
    private Booking payableBooking(UUID salonId, Long bookingId) {
        var api = bookings.getIfAvailable();
        if (api == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Appointments aren't available");
        var booking = api.findById(salonId, bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Appointment not found"));
        if (booking.status() == BookingStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This appointment was cancelled");
        }
        if ("PAID".equals(booking.paymentStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This appointment has already been paid for");
        }
        return booking;
    }

    /**
     * Marks every appointment on a settled sale as paid. The booking side is a conditional update, so
     * an online payment that lands at the same moment simply loses the race rather than double-paying.
     */
    private void markBookingsPaid(UUID salonId, PosSale sale) {
        var api = bookings.getIfAvailable();
        if (api == null) return;
        sale.lines().stream()
                .filter(line -> line.sourceType() == PosSale.SourceType.BOOKING)
                .forEach(line -> api.markPaidAtDesk(salonId, line.sourceId(), sale.saleNumber()));
    }

    /** Today's appointments the desk can still take money for, shaped like any other till item. */
    List<CashierItem> cashierBookings(UUID salonId, LocalDate date) {
        requireDashboard(salonId);
        if (!settings(salonId).cashierEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cashier is disabled");
        }
        var api = bookings.getIfAvailable();
        if (api == null) return List.of();
        var day = date != null ? date : LocalDate.now(ZoneOffset.UTC);
        return api.findPayableAtDesk(salonId, day).stream()
                .map(booking -> serviceApi.findByIdAndSalonId(booking.serviceId(), salonId)
                        .filter(s -> s.price() != null)
                        .map(service -> new CashierItem(PosSale.SourceType.BOOKING, booking.id(), service.name(),
                                booking.customerName() + " · " + booking.startTime(),
                                service.price(), service.currency() == null ? "USD" : service.currency(), 1))
                        .orElse(null))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    /**
     * Deliberately not {@code @Transactional}, for the same reason as {@link #createTerminalCheckout}
     * below: the sale is committed before Stripe is called. Creating the Checkout Session inside the
     * transaction would pin a database connection across a network round-trip, and — because a Stripe
     * session cannot be rolled back — a commit failure after it would leave a live, payable session
     * with no sale behind it. With the sale committed first, the catch below is a real compensation.
     */
    CardCheckout createCardCheckout(UUID salonId, String customerName, List<SaleItemRequest> requestedItems,
                                    boolean inlineCheckout, String idempotencyKey, String actor) {
        stripe.requireEnabled(salonId, "POS");
        var pending = tx.execute(status -> pendingCardSale(salonId, customerName, requestedItems, idempotencyKey, actor));
        try {
            var checkout = stripe.createCheckout(salonId, new PaymentGateway.CheckoutRequest("POS", String.valueOf(pending.id()),
                    pending.total(), pending.currency(), "Salon purchase " + pending.saleNumber(), null, null, inlineCheckout));
            return new CardCheckout(pending, checkout);
        } catch (RuntimeException e) {
            tx.executeWithoutResult(status -> recordStripePayment(salonId, pending.id(), "checkout-creation-failed", false));
            throw e;
        }
    }

    /**
     * A card sale paid on one of the salon's card readers. The sale (and its stock hold) is committed first, so
     * the reader's outcome — which can arrive within seconds — always finds it; the {@code StripePaymentEvent}
     * then marks it paid, or failed with the stock put back.
     */
    TerminalCheckout createTerminalCheckout(UUID salonId, String customerName, List<SaleItemRequest> requestedItems,
                                            Long terminalId, String idempotencyKey, String actor) {
        stripe.requireEnabled(salonId, "POS");
        if (terminalId == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a card reader");
        var pending = tx.execute(status -> pendingCardSale(salonId, customerName, requestedItems, idempotencyKey, actor));
        try {
            var payment = stripe.collectOnTerminal(salonId, "POS", String.valueOf(pending.id()), pending.total(),
                    pending.currency(), "Salon purchase " + pending.saleNumber(), terminalId);
            return new TerminalCheckout(pending, payment);
        } catch (RuntimeException e) {
            tx.executeWithoutResult(status -> recordStripePayment(salonId, pending.id(), "terminal-start-failed", false));
            throw e;
        }
    }

    private PosSale pendingCardSale(UUID salonId, String customerName, List<SaleItemRequest> requestedItems,
                                    String idempotencyKey, String actor) {
        // A card sale that already exists for this cart must not be touched: re-saving it as PENDING
        // would flip a sale that was paid (or failed) back to waiting. The reply to the first request
        // may have been lost, so tell the operator where to look rather than starting a second charge.
        if (replayOf(salonId, idempotencyKey) != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This card sale was already started — check Recent sales for its status.");
        }
        var sale = createSale(salonId, customerName, PosSale.PaymentMethod.CARD, requestedItems, idempotencyKey, actor);
        return saleRepository.save(sale.awaitingPayment());
    }

    @Transactional
    void recordStripePayment(UUID salonId, Long saleId, String sessionId, boolean succeeded) {
        var sale = saleRepository.findById(saleId).filter(s -> s.salonId().equals(salonId)).orElse(null);
        if (sale == null || !"PENDING".equals(sale.paymentStatus())) return;
        var updated = jdbc.sql("UPDATE pos_sale SET payment_status = :status, payment_reference = :session WHERE id = :id AND salon_id = :salon AND payment_status = 'PENDING'")
                .param("status", succeeded ? "PAID" : "FAILED").param("session", sessionId)
                .param("id", saleId).param("salon", salonId).update();
        if (updated != 1) return;
        if (succeeded) {
            markBookingsPaid(salonId, sale);
        } else {
            sale.lines().stream().filter(line -> line.sourceType() == PosSale.SourceType.PRODUCT)
                    .forEach(line -> shopApi.incrementStock(salonId, line.sourceId(), line.quantity()));
        }
    }

    /**
     * Fails till sales left waiting for a card payment, putting their stock back.
     *
     * <p>A card sale holds its stock from the moment it is rung up. Settlement normally arrives as a
     * {@code StripePaymentEvent}, but a customer who walks away from the reader produces no event at
     * all, and an abandoned online checkout only expires after Stripe's 24-hour default — so without
     * this, the last unit of a product stays unsellable for a day or forever. Reuses
     * {@link #recordStripePayment} so the restore and its conditional UPDATE are the same ones the
     * webhook path uses, which also makes a late webhook harmless: whichever lands first wins.
     */
    @Scheduled(fixedDelayString = "${spring.application.dashboard.stale-sale-sweep:PT5M}")
    void failAbandonedCardSales() {
        var cutoff = Instant.now().minus(staleCardSaleAfter);
        var stale = jdbc.sql("SELECT id, salon_id FROM pos_sale WHERE payment_status = 'PENDING' AND created_at < :cutoff")
                .param("cutoff", OffsetDateTime.ofInstant(cutoff, ZoneOffset.UTC))
                .query((rs, n) -> Map.entry((UUID) rs.getObject("salon_id"), rs.getLong("id")))
                .list();
        for (var row : stale) {
            tx.executeWithoutResult(status -> recordStripePayment(row.getKey(), row.getValue(), "abandoned-at-the-till", false));
        }
        if (!stale.isEmpty()) log.info("[DashboardManager] Released {} abandoned till card sale(s)", stale.size());
    }

    /**
     * The day's takings, for closing the till. Only settled, un-voided sales count as money taken; a
     * card sale still waiting is reported separately so nobody counts it as cash in the drawer.
     *
     * <p>"Day" is the caller's calendar day in {@code zone}. The server has no notion of a salon's
     * timezone, but the counter's browser is in it, and a midnight boundary in the wrong zone puts a
     * 00:30 sale on the wrong day's sheet.
     */
    DailyReport dailyReport(UUID salonId, java.time.LocalDate date, String zone) {
        requireDashboard(salonId);
        if (!settings(salonId).cashierEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cashier is disabled");
        }
        java.time.ZoneId zoneId;
        try {
            zoneId = zone == null || zone.isBlank() ? ZoneOffset.UTC : java.time.ZoneId.of(zone.strip());
        } catch (java.time.DateTimeException e) {
            zoneId = ZoneOffset.UTC;
        }
        var day = date != null ? date : LocalDate.now(zoneId);
        var from = day.atStartOfDay(zoneId).toInstant();
        var to = day.plusDays(1).atStartOfDay(zoneId).toInstant();
        var f = OffsetDateTime.ofInstant(from, ZoneOffset.UTC);
        var t = OffsetDateTime.ofInstant(to, ZoneOffset.UTC);

        var takings = new ArrayList<>(jdbc.sql("""
                        SELECT currency, payment_method AS method, count(*) AS n, COALESCE(sum(total), 0) AS total
                        FROM pos_sale
                        WHERE salon_id = :salon AND created_at >= :from AND created_at < :to
                          AND payment_status = 'PAID' AND voided_at IS NULL
                        GROUP BY currency, payment_method""")
                .param("salon", salonId).param("from", f).param("to", t)
                .query((rs, i) -> new MethodTotal(rs.getString("currency"), rs.getString("method"),
                        rs.getLong("n"), rs.getBigDecimal("total")))
                .list());
        var refunded = new ArrayList<MethodTotal>();
        var membershipApi = memberships.getIfAvailable();
        if (membershipApi != null) {
            membershipApi.takings(salonId, from, to).forEach(m ->
                    takings.add(new MethodTotal(m.currency(), m.method(), m.count(), m.total())));
            membershipApi.refunds(salonId, from, to).forEach(m ->
                    refunded.add(new MethodTotal(m.currency(), m.method(), m.count(), m.total())));
        }

        var byPerson = jdbc.sql("""
                        SELECT COALESCE(created_by, 'Unknown') AS person, currency, count(*) AS n, COALESCE(sum(total), 0) AS total
                        FROM pos_sale
                        WHERE salon_id = :salon AND created_at >= :from AND created_at < :to
                          AND payment_status = 'PAID' AND voided_at IS NULL
                        GROUP BY COALESCE(created_by, 'Unknown'), currency
                        ORDER BY total DESC""")
                .param("salon", salonId).param("from", f).param("to", t)
                .query((rs, i) -> new PersonTotal(rs.getString("person"), rs.getString("currency"),
                        rs.getLong("n"), rs.getBigDecimal("total")))
                .list();

        var voided = jdbc.sql("""
                        SELECT currency, count(*) AS n, COALESCE(sum(total), 0) AS total
                        FROM pos_sale
                        WHERE salon_id = :salon AND voided_at >= :from AND voided_at < :to
                        GROUP BY currency""")
                .param("salon", salonId).param("from", f).param("to", t)
                .query((rs, i) -> new Reversed(rs.getString("currency"), rs.getLong("n"), rs.getBigDecimal("total")))
                .list();

        long awaiting = jdbc.sql("""
                        SELECT count(*) FROM pos_sale
                        WHERE salon_id = :salon AND created_at >= :from AND created_at < :to
                          AND payment_status = 'PENDING'""")
                .param("salon", salonId).param("from", f).param("to", t).query(Long.class).single();

        return new DailyReport(day, zoneId.getId(), takings, refunded, byPerson, voided, awaiting);
    }

    List<PosSale> recentSales(UUID salonId) {
        requireDashboard(salonId);
        // Takings are till data: with the cashier switched off the desk shouldn't read them either,
        // not just be unable to add to them.
        if (!settings(salonId).cashierEnabled()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Cashier is disabled");
        }
        return saleRepository.findTop50BySalonIdOrderByCreatedAtDesc(salonId);
    }

    private Salon requireDashboard(UUID salonId) {
        var salon = salonApi.findById(salonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Salon not found"));
        if (!hasFeature(salon, SalonFeature.DASHBOARD)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Dashboard feature is not enabled");
        }
        return salon;
    }

    private boolean hasFeature(Salon salon, SalonFeature feature) {
        return salon.features().stream().anyMatch(f -> f.feature() == feature);
    }

    private DashboardSettings defaults(UUID salonId) {
        var salon = salonApi.findById(salonId).orElseThrow();
        return new DashboardSettings(salonId, hasFeature(salon, SalonFeature.BOOKING), true, null);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
