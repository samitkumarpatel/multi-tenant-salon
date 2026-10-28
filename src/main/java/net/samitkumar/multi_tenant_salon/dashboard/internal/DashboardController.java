package net.samitkumar.multi_tenant_salon.dashboard.internal;

import net.samitkumar.multi_tenant_salon.dashboard.DashboardSettings;
import net.samitkumar.multi_tenant_salon.dashboard.PosSale;
import net.samitkumar.multi_tenant_salon.payments.PaymentGateway;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/salon-admin/{salonId}/dashboard")
class DashboardController {
    private final DashboardManager dashboard;
    private final TillShifts tillShifts;
    private final WalkInQueue walkIns;
    private final SalonApi salonApi;

    DashboardController(DashboardManager dashboard, TillShifts tillShifts, WalkInQueue walkIns, SalonApi salonApi) {
        this.walkIns = walkIns;
        this.tillShifts = tillShifts;
        this.dashboard = dashboard;
        this.salonApi = salonApi;
    }

    record SettingsRequest(boolean bookingManagementEnabled, boolean cashierEnabled) {}
    /** {@code inlineCheckout}: the desk shows Stripe's form itself; {@code terminalId}: the card reader to use. */
    /** {@code idempotencyKey}: the till's own key for this cart, so a retried request returns the same sale. */
    record SaleRequest(String customerName, PosSale.PaymentMethod paymentMethod,
                       List<DashboardManager.SaleItemRequest> items, Boolean inlineCheckout, Long terminalId,
                       String idempotencyKey, DashboardManager.DiscountType discountType, BigDecimal discountValue,
                       String discountReason, BigDecimal tipAmount, String customerEmail, String loyaltyCode, Boolean applyMembership) {
        DashboardManager.Adjustments adjustments() {
            return new DashboardManager.Adjustments(discountType, discountValue, discountReason, tipAmount, customerEmail, loyaltyCode, Boolean.TRUE.equals(applyMembership));
        }
    }
    record VoidRequest(String reason) {}
    record ReceiptRequest(String email) {}
    record OpenShiftRequest(BigDecimal openingFloat, String currency) {}
    record CloseShiftRequest(BigDecimal countedCash, String note) {}

    /** The signed-in person, or null when security is off for local development. */
    private static String actor(Jwt jwt) {
        return jwt == null ? null : jwt.getSubject();
    }
    record CardCheckoutResponse(PosSale sale, String checkoutUrl, PaymentGateway.Checkout checkout) {}
    record TerminalCheckoutResponse(PosSale sale, PaymentGateway.TerminalPayment terminalPayment) {}

    @GetMapping("/settings")
    DashboardSettings settings(@PathVariable String salonId) {
        return dashboard.settings(salonApi.resolveId(salonId));
    }

    @PutMapping("/settings")
    DashboardSettings updateSettings(@PathVariable String salonId, @RequestBody SettingsRequest request) {
        return dashboard.updateSettings(salonApi.resolveId(salonId), request.bookingManagementEnabled(),
                request.cashierEnabled());
    }

    @GetMapping("/cashier/items")
    List<DashboardManager.CashierItem> cashierItems(@PathVariable String salonId) {
        return dashboard.cashierItems(salonApi.resolveId(salonId));
    }

    /** Appointments the customer can settle at the counter — defaults to today. */
    @GetMapping("/cashier/bookings")
    List<DashboardManager.CashierItem> cashierBookings(
            @PathVariable String salonId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return dashboard.cashierBookings(salonApi.resolveId(salonId), date);
    }

    /** Reverses a sale rung up wrong: stock back, appointments owed again, card money refunded. */
    @PostMapping("/sales/{saleId}/void")
    ResponseEntity<PosSale> voidSale(@PathVariable String salonId, @PathVariable Long saleId,
                                     @RequestBody(required = false) VoidRequest request,
                                     @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        return ResponseEntity.ok(dashboard.voidSale(salonApi.resolveId(salonId), saleId,
                request == null ? null : request.reason(), actor(jwt)));
    }

    @GetMapping("/walk-ins")
    List<WalkInQueue.Entry> waitingWalkIns(@PathVariable String salonId) {
        return walkIns.waiting(salonApi.resolveId(salonId));
    }

    @PostMapping("/walk-ins")
    WalkInQueue.Entry addWalkIn(@PathVariable String salonId, @RequestBody WalkInQueue.Request request,
                                @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        return walkIns.add(salonApi.resolveId(salonId), request, actor(jwt));
    }

    /** {@code action} is {@code seat} (being served) or {@code leave} (gave up waiting). */
    @PostMapping("/walk-ins/{id}/{action:seat|leave}")
    ResponseEntity<Void> resolveWalkIn(@PathVariable String salonId, @PathVariable Long id, @PathVariable String action) {
        walkIns.resolve(salonApi.resolveId(salonId), id, "seat".equals(action) ? "SEATED" : "LEFT");
        return ResponseEntity.noContent().build();
    }

    /** The open cash-drawer shift with what it should hold now; 204 when none is open. */
    @GetMapping("/shift")
    ResponseEntity<TillShifts.Shift> currentShift(@PathVariable String salonId) {
        return tillShifts.current(salonApi.resolveId(salonId)).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/shifts")
    List<TillShifts.Shift> shifts(@PathVariable String salonId) {
        return tillShifts.recent(salonApi.resolveId(salonId));
    }

    @PostMapping("/shift/open")
    TillShifts.Shift openShift(@PathVariable String salonId, @RequestBody OpenShiftRequest request,
                               @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        return tillShifts.open(salonApi.resolveId(salonId), request.openingFloat(), request.currency(), actor(jwt));
    }

    @PostMapping("/shift/close")
    TillShifts.Shift closeShift(@PathVariable String salonId, @RequestBody CloseShiftRequest request,
                                @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        return tillShifts.close(salonApi.resolveId(salonId), request.countedCash(), request.note(), actor(jwt));
    }

    /** Emails the customer a receipt for a settled sale. */
    @PostMapping("/sales/{saleId}/receipt")
    ResponseEntity<Void> emailReceipt(@PathVariable String salonId, @PathVariable Long saleId, @RequestBody ReceiptRequest request) {
        dashboard.sendReceipt(salonApi.resolveId(salonId), saleId, request.email());
        return ResponseEntity.accepted().build();
    }

    /**
     * The end-of-day sheet for closing the till. {@code zone} is the caller's IANA timezone (the
     * counter's browser knows the salon's), because the server has no timezone of its own for a salon.
     */
    @GetMapping("/reports/daily")
    DashboardManager.DailyReport dailyReport(
            @PathVariable String salonId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String zone) {
        return dashboard.dailyReport(salonApi.resolveId(salonId), date, zone);
    }

    @GetMapping("/sales")
    List<PosSale> sales(@PathVariable String salonId) {
        return dashboard.recentSales(salonApi.resolveId(salonId));
    }

    @PostMapping("/sales")
    ResponseEntity<PosSale> createSale(@PathVariable String salonId, @RequestBody SaleRequest request,
                                       @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        if (request.paymentMethod() == PosSale.PaymentMethod.CARD) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,
                    "Use the card checkout endpoint for Stripe payments");
        }
        return ResponseEntity.ok(dashboard.createSale(salonApi.resolveId(salonId), request.customerName(),
                request.paymentMethod(), request.items(), request.adjustments(), request.idempotencyKey(), actor(jwt)));
    }

    @PostMapping("/sales/card-checkout")
    ResponseEntity<CardCheckoutResponse> createCardCheckout(@PathVariable String salonId, @RequestBody SaleRequest request,
                                                            @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        var result = dashboard.createCardCheckout(salonApi.resolveId(salonId), request.customerName(), request.items(),
                request.adjustments(), Boolean.TRUE.equals(request.inlineCheckout()), request.idempotencyKey(), actor(jwt));
        return ResponseEntity.ok(new CardCheckoutResponse(result.sale(), result.checkout().url(), result.checkout()));
    }

    /** Card sale on one of the salon's card readers; poll {@code /payments/terminal-payments/{id}} for the outcome. */
    @PostMapping("/sales/terminal-checkout")
    ResponseEntity<TerminalCheckoutResponse> createTerminalCheckout(@PathVariable String salonId, @RequestBody SaleRequest request,
                                                                    @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        var result = dashboard.createTerminalCheckout(salonApi.resolveId(salonId), request.customerName(), request.items(),
                request.adjustments(), request.terminalId(), request.idempotencyKey(), actor(jwt));
        return ResponseEntity.ok(new TerminalCheckoutResponse(result.sale(), result.terminalPayment()));
    }

}
