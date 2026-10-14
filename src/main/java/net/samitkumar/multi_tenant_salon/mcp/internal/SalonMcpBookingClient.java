package net.samitkumar.multi_tenant_salon.mcp.internal;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.service.annotation.HttpExchange;
import org.springframework.web.service.annotation.PostExchange;

/** Calls the public customer booking endpoint so MCP bookings share its payment and policy rules. */
@HttpExchange("/api/salon")
interface SalonMcpBookingClient {
    record CreateBookingRequest(Long serviceId, Long staffId, String customerName,
                                String customerEmail, String customerPhone,
                                String appointmentDate, String startTime, String notes,
                                String returnUrl) {}

    @PostExchange("/{salonId}/booking")
    String createBooking(@PathVariable String salonId, @RequestBody CreateBookingRequest request);
}
