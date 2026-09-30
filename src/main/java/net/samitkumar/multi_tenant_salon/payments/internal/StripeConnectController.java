package net.samitkumar.multi_tenant_salon.payments.internal;

import net.samitkumar.multi_tenant_salon.payments.SalonPaymentSettings;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/api/salon-admin/{salonId}/payments")
class StripeConnectController {
    record ConnectStatus(StripeConnectService.Status stripe) {}
    record UpdateSettings(boolean shopEnabled, boolean bookingEnabled, boolean posEnabled,
                          SalonPaymentSettings.BookingPaymentType bookingPaymentType,
                          int bookingDepositPercent) {}
    record OnboardingLink(String url) {}

    private final StripeConnectService payments;
    private final SalonApi salons;

    StripeConnectController(StripeConnectService payments, SalonApi salons) {
        this.payments = payments;
        this.salons = salons;
    }

    @GetMapping("/stripe")
    ConnectStatus status(@PathVariable String salonId) {
        return new ConnectStatus(payments.status(resolve(salonId)));
    }

    @PostMapping("/stripe/onboarding-link")
    OnboardingLink onboardingLink(@PathVariable String salonId) {
        return new OnboardingLink(payments.onboardingUrl(resolve(salonId)));
    }

    @PutMapping("/settings")
    SalonPaymentSettings update(@PathVariable String salonId, @RequestBody UpdateSettings request) {
        if (request.bookingPaymentType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Booking payment type is required");
        }
        return payments.update(resolve(salonId), request.shopEnabled(), request.bookingEnabled(), request.posEnabled(),
                request.bookingPaymentType(), request.bookingDepositPercent());
    }

    private UUID resolve(String salonId) { return salons.resolveId(salonId); }
}
