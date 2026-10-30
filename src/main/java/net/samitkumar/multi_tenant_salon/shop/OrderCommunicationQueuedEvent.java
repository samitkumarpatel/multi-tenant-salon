package net.samitkumar.multi_tenant_salon.shop;

import java.util.UUID;

/** Durable dispatch request. A generation invalidates older automatic retries after a manual retry. */
public record OrderCommunicationQueuedEvent(UUID salonId, Long communicationId, int generation) {}
