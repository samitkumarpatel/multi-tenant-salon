package net.samitkumar.multi_tenant_salon.chat.internal;

/**
 * A booking the assistant has proposed but not created. Field names match
 * {@code BookingController.CreateBookingRequest} exactly so the frontend can forward this object
 * almost verbatim to {@code POST /api/salon/{salonId}/booking} once the visitor confirms it —
 * this module never calls that (or any other mutating) endpoint itself.
 */
record PendingBooking(Long serviceId, Long staffId, String appointmentDate, String startTime,
                       String customerName, String customerEmail, String customerPhone, String notes) {
}
