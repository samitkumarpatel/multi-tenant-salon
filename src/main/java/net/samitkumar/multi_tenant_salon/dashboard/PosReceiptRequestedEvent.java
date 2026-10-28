package net.samitkumar.multi_tenant_salon.dashboard;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** The desk asked for a till sale's receipt to be emailed to the customer. */
public record PosReceiptRequestedEvent(
        UUID salonId, String salonName, String salonPhone, String salonEmail,
        String saleNumber, String customerName, String customerEmail,
        PosSale.PaymentMethod paymentMethod, String currency, BigDecimal total, Instant createdAt,
        BigDecimal subtotal, BigDecimal discountAmount, BigDecimal tipAmount, List<Line> lines) {

    public record Line(String itemName, int quantity, BigDecimal unitPrice, BigDecimal lineTotal) {}
}
