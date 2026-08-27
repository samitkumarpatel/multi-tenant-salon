package net.samitkumar.multi_tenant_salon.chat.internal;

/**
 * Tells the frontend which interactive generative-UI component to render for this turn. The
 * assistant sets it by calling one of the {@code show*} / {@code startBookingPicker} tools on
 * {@link SalonDataTools} (instead of the frontend guessing from the reply text). The frontend
 * maps {@code component} to a React card and silently ignores any component it doesn't know, so
 * a mis-named component can never break a turn. Only the last directive of a turn is kept.
 * Booking <em>creation</em> is unaffected — that still flows through {@code proposeBooking} /
 * {@link PendingBooking}.
 */
record UiDirective(
        /** services | staff | hours | location | contact | booking-picker */
        String component,
        /** booking-picker: the service to book */
        Long serviceId,
        /** booking-picker: preferred staff member, if the visitor named one */
        Long staffId,
        /** services: restrict to what this staff member offers */
        Long forStaffId,
        /** staff: restrict to who can perform this service */
        Long forServiceId,
        /** services: {@code true} frames the card as "pick one to book" rather than browsing */
        Boolean forBooking
) {
    static UiDirective of(String component) {
        return new UiDirective(component, null, null, null, null, null);
    }
}
