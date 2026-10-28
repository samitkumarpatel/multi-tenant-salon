package net.samitkumar.multi_tenant_salon.loyalty;

import java.util.UUID;

/** A till sale was voided or its card payment failed: whatever it earned is taken back. */
public record CounterSaleVoidedEvent(UUID salonId, Long saleId) {}
