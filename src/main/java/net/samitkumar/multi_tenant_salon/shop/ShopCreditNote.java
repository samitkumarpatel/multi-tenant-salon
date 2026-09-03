package net.samitkumar.multi_tenant_salon.shop;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Table("shop_credit_note")
public record ShopCreditNote(
        @Id Long id,
        UUID salonId,
        Long orderId,
        BigDecimal amount,
        String reason,
        String reference,
        String status,
        Instant createdAt
) {}
