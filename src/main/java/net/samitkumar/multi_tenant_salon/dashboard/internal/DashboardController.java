package net.samitkumar.multi_tenant_salon.dashboard.internal;

import net.samitkumar.multi_tenant_salon.dashboard.DashboardSettings;
import net.samitkumar.multi_tenant_salon.dashboard.PosSale;
import net.samitkumar.multi_tenant_salon.payments.PaymentGateway;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
    record SaleRequest(String customerName, PosSale.PaymentMethod paymentMethod,
                       List<DashboardManager.SaleItemRequest> items, Boolean inlineCheckout, Long terminalId) {}
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

    @GetMapping("/sales")
    List<PosSale> sales(@PathVariable String salonId) {
        return dashboard.recentSales(salonApi.resolveId(salonId));
    }

    @PostMapping("/sales")
    ResponseEntity<PosSale> createSale(@PathVariable String salonId, @RequestBody SaleRequest request) {
        if (request.paymentMethod() == PosSale.PaymentMethod.CARD) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,
                    "Use the card checkout endpoint for Stripe payments");
        }
        return ResponseEntity.ok(dashboard.createSale(salonApi.resolveId(salonId), request.customerName(),
                request.paymentMethod(), request.items()));
    }

    @PostMapping("/sales/card-checkout")
    ResponseEntity<CardCheckoutResponse> createCardCheckout(@PathVariable String salonId, @RequestBody SaleRequest request) {
        var result = dashboard.createCardCheckout(salonApi.resolveId(salonId), request.customerName(), request.items(),
                Boolean.TRUE.equals(request.inlineCheckout()));
        return ResponseEntity.ok(new CardCheckoutResponse(result.sale(), result.checkout().url(), result.checkout()));
    }

    /** Card sale on one of the salon's card readers; poll {@code /payments/terminal-payments/{id}} for the outcome. */
    @PostMapping("/sales/terminal-checkout")
    ResponseEntity<TerminalCheckoutResponse> createTerminalCheckout(@PathVariable String salonId, @RequestBody SaleRequest request) {
        var result = dashboard.createTerminalCheckout(salonApi.resolveId(salonId), request.customerName(), request.items(),
                request.terminalId());
        return ResponseEntity.ok(new TerminalCheckoutResponse(result.sale(), result.terminalPayment()));
    }

}
