package net.samitkumar.multi_tenant_salon.dashboard.internal;

import net.samitkumar.multi_tenant_salon.dashboard.DashboardSettings;
import net.samitkumar.multi_tenant_salon.dashboard.PosSale;
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

    record SettingsRequest(boolean bookingManagementEnabled, boolean cashierEnabled,
                           boolean notificationsEnabled, String defaultNotification) {}
    record SaleRequest(String customerName, PosSale.PaymentMethod paymentMethod,
                       List<DashboardManager.SaleItemRequest> items) {}
    record NotificationRequest(String subject, String message) {}

    @GetMapping("/settings")
    DashboardSettings settings(@PathVariable String salonId) {
        return dashboard.settings(salonApi.resolveId(salonId));
    }

    @PutMapping("/settings")
    DashboardSettings updateSettings(@PathVariable String salonId, @RequestBody SettingsRequest request) {
        return dashboard.updateSettings(salonApi.resolveId(salonId), request.bookingManagementEnabled(),
                request.cashierEnabled(), request.notificationsEnabled(), request.defaultNotification());
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
        return ResponseEntity.ok(dashboard.createSale(salonApi.resolveId(salonId), request.customerName(),
                request.paymentMethod(), request.items()));
    }

    @PostMapping("/bookings/{bookingId}/notifications")
    ResponseEntity<Void> notifyCustomer(@PathVariable String salonId, @PathVariable Long bookingId,
                                        @RequestBody(required = false) NotificationRequest request) {
        dashboard.notifyBookingCustomer(salonApi.resolveId(salonId), bookingId,
                request == null ? null : request.subject(), request == null ? null : request.message());
        return ResponseEntity.accepted().build();
    }
}
