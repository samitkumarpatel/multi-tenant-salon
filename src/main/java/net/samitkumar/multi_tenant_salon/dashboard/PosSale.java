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
        @MappedCollection(idColumn = "sale_id", keyColumn = "sale_key") List<Line> lines
) {
    public enum PaymentMethod { CASH, CARD, OTHER }
    public enum SourceType { SERVICE, PRODUCT }

    public PosSale {
        lines = lines != null ? List.copyOf(lines) : List.of();
    }

    @Table("pos_sale_line")
    public record Line(@Id Long id, SourceType sourceType, Long sourceId, String itemName,
                       BigDecimal unitPrice, int quantity, BigDecimal lineTotal) {}
}
