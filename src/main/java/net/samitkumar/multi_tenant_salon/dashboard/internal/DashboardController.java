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

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/salon-admin/{salonId}/dashboard")
class DashboardController {
    private final DashboardManager dashboard;
    private final SalonApi salonApi;

    DashboardController(DashboardManager dashboard, SalonApi salonApi) {
        this.dashboard = dashboard;
        this.salonApi = salonApi;
    }

    record SettingsRequest(boolean bookingManagementEnabled, boolean cashierEnabled) {}
    /** {@code inlineCheckout}: the desk shows Stripe's form itself; {@code terminalId}: the card reader to use. */
    /** {@code idempotencyKey}: the till's own key for this cart, so a retried request returns the same sale. */
    record SaleRequest(String customerName, PosSale.PaymentMethod paymentMethod,
                       List<DashboardManager.SaleItemRequest> items, Boolean inlineCheckout, Long terminalId,
                       String idempotencyKey) {}
    record VoidRequest(String reason) {}

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
                request.paymentMethod(), request.items(), request.idempotencyKey(), actor(jwt)));
    }

    @PostMapping("/sales/card-checkout")
    ResponseEntity<CardCheckoutResponse> createCardCheckout(@PathVariable String salonId, @RequestBody SaleRequest request,
                                                            @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        var result = dashboard.createCardCheckout(salonApi.resolveId(salonId), request.customerName(), request.items(),
                Boolean.TRUE.equals(request.inlineCheckout()), request.idempotencyKey(), actor(jwt));
        return ResponseEntity.ok(new CardCheckoutResponse(result.sale(), result.checkout().url(), result.checkout()));
    }

    /** Card sale on one of the salon's card readers; poll {@code /payments/terminal-payments/{id}} for the outcome. */
    @PostMapping("/sales/terminal-checkout")
    ResponseEntity<TerminalCheckoutResponse> createTerminalCheckout(@PathVariable String salonId, @RequestBody SaleRequest request,
                                                                    @AuthenticationPrincipal(errorOnInvalidType = false) Jwt jwt) {
        var result = dashboard.createTerminalCheckout(salonApi.resolveId(salonId), request.customerName(), request.items(),
                request.terminalId(), request.idempotencyKey(), actor(jwt));
        return ResponseEntity.ok(new TerminalCheckoutResponse(result.sale(), result.terminalPayment()));
    }

}
