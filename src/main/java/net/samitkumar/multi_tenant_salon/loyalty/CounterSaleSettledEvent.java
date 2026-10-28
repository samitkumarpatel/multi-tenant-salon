package net.samitkumar.multi_tenant_salon.loyalty;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * A till sale was paid. {@code earnableAmount} is what counts towards points: the items sold at the counter
 * after any discount, without the tip and without appointments (those earn when they are completed).
 * Defined here, not in {@code dashboard}, so the till can call loyalty without loyalty depending back on it.
 */
public record CounterSaleSettledEvent(UUID salonId, Long saleId, String customerEmail, BigDecimal earnableAmount) {}
