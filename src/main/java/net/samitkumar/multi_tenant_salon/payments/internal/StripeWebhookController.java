package net.samitkumar.multi_tenant_salon.payments.internal;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
class StripeWebhookController {
    private final StripeConnectService payments;

    StripeWebhookController(StripeConnectService payments) { this.payments = payments; }

    @PostMapping("/api/payments/stripe/webhook")
    ResponseEntity<Void> webhook(@RequestBody String payload,
                                 @RequestHeader("Stripe-Signature") String signature) {
        payments.handleWebhook(payload, signature);
        return ResponseEntity.ok().build();
    }
}
