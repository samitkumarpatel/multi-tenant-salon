package net.samitkumar.multi_tenant_salon.dashboard;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Table("pos_sale")
public record PosSale(
        @Id Long id,
        UUID salonId,
        String saleNumber,
        String customerName,
        PaymentMethod paymentMethod,
        BigDecimal total,
        String currency,
        Instant createdAt,
        String paymentStatus,
        String paymentReference,
        /** The till's own key for the cart that produced this sale, so a retried request can't duplicate it. */
        String idempotencyKey,
        Instant voidedAt,
        String voidReason,
        /** How much has been given back, for a card sale that was refunded rather than simply voided. */
        BigDecimal refundedAmount,
        /** Sign-in email of whoever rang it up / reversed it, so a short drawer can be traced to a person. */
        String createdBy,
        String voidedBy,
        @MappedCollection(idColumn = "sale_id", keyColumn = "sale_key") List<Line> lines
) {
    /** A sale that has been reversed: stock is back and no money is owed on it. */
    public boolean voided() {
        return voidedAt != null;
    }

    /** A freshly rung-up sale — nothing settled by Stripe, nothing voided, nothing refunded. */
    public static PosSale rungUp(UUID salonId, String saleNumber, String customerName, PaymentMethod method,
                                 BigDecimal total, String currency, Instant createdAt, String paymentStatus,
                                 String idempotencyKey, String createdBy, List<Line> lines) {
        return new PosSale(null, salonId, saleNumber, customerName, method, total, currency, createdAt,
                paymentStatus, null, idempotencyKey, null, null, null, createdBy, null, lines);
    }

    /** The same sale awaiting a card payment instead of being settled on the spot. */
    public PosSale awaitingPayment() {
        return new PosSale(id, salonId, saleNumber, customerName, paymentMethod, total, currency, createdAt,
                "PENDING", null, idempotencyKey, voidedAt, voidReason, refundedAmount, createdBy, voidedBy, lines);
    }

    public enum PaymentMethod { CASH, CARD, OTHER }
    /**
     * {@code BOOKING} is an appointment the customer already made online and is now settling at the
     * counter — priced from its service, and marked paid on the booking itself once the sale settles.
     */
    public enum SourceType { SERVICE, PRODUCT, BOOKING }

    public PosSale {
        if (paymentStatus == null) paymentStatus = "PAID";
        lines = lines != null ? List.copyOf(lines) : List.of();
    }

    @Table("pos_sale_line")
    public record Line(@Id Long id, SourceType sourceType, Long sourceId, String itemName,
                       BigDecimal unitPrice, int quantity, BigDecimal lineTotal) {}
}
