package net.samitkumar.multi_tenant_salon.booking;

import java.time.Duration;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.LocalDate;

public interface BookingApi {
    Optional<Booking> findById(UUID salonId, Long bookingId);

    /**
     * Appointments on {@code date} the salon desk could still take money for — not cancelled, and not
     * already paid. The common case is a customer who booked online without paying upfront
     * ({@code NOT_REQUIRED}) and settles at the counter when they arrive.
     */
    List<Booking> findPayableAtDesk(UUID salonId, LocalDate date);

    /**
     * Settles an appointment paid at the counter. Conditional on it not already being paid, so a desk
     * payment and a late online one can't both land — whichever arrives first wins and the other is a
     * no-op. Leaves the appointment's own status alone: paying and confirming are separate decisions.
     *
     * @return whether this call was the one that marked it paid
     */
    boolean markPaidAtDesk(UUID salonId, Long bookingId, String reference);

    /**
     * Undoes {@link #markPaidAtDesk} when the till sale that settled it is voided. Conditional on the
     * booking still pointing at that sale, so a later payment by other means is never clobbered.
     *
     * @return whether this call was the one that put the appointment back to unpaid
     */
    boolean clearDeskPayment(UUID salonId, Long bookingId, String reference);
    List<Booking> findByStaff(UUID salonId, Long staffId);

    /** Every booking the salon holds under {@code email} (matched case-insensitively), newest appointment first. */
    List<Booking> findByCustomerEmail(UUID salonId, String email);

    /**
     * Erases a customer's personal details from every booking the salon holds under {@code email}
     * (matched case-insensitively): name and phone are blanked and the email replaced, so the
     * appointments stay for the salon's records but no longer point at anyone.
     *
     * @return how many bookings were rewritten
     */
    int anonymizeCustomer(UUID salonId, String email, String replacementEmail);

    /**
     * A customer cancels their own appointment. Checked under a row lock: it must be this customer's
     * (matched case-insensitively — anyone else's is "not found"), still {@code PENDING} or {@code CONFIRMED},
     * start at least {@code minNotice} from now, and not be paid online (nothing here refunds a card
     * payment, so those go through the salon). Cancelling an already cancelled booking is a no-op.
     * Publishes the usual status-changed event, so the customer and salon are emailed.
     *
     * @throws org.springframework.web.server.ResponseStatusException 404 not theirs, 409 not allowed now
     */
    Booking cancelForCustomer(UUID salonId, Long bookingId, String customerEmail, Duration minNotice);

    /**
     * A customer moves their own appointment to another slot. Same ownership, status and notice rules as
     * {@link #cancelForCustomer}, and the new time must be one the booking page would offer (salon hours,
     * closures, staff schedule, no overlap) and still in the future. The status is kept. Publishes the
     * usual rescheduled event.
     *
     * @param staffId the staff member of the chosen slot, or null to keep the current one
     * @throws org.springframework.web.server.ResponseStatusException 404 not theirs, 409 not allowed / slot taken
     */
    Booking rescheduleForCustomer(UUID salonId, Long bookingId, String customerEmail,
                                  LocalDate newDate, LocalTime newStartTime, Long staffId, Duration minNotice);
    List<StaffAvailabilityOverride> getOverrides(UUID salonId, Long staffId);
    StaffAvailabilityOverride addOverride(UUID salonId, Long staffId, StaffAvailabilityOverride override);
    void removeOverride(UUID salonId, Long staffId, Long overrideId);
    List<AvailableSlot> findAvailableSlots(UUID salonId, Long serviceId, LocalDate date, Long staffId);
    SalonAvailability queryAvailability(UUID salonId, Long serviceId, Long staffId, LocalDate from, LocalDate to,
                                        SalonAvailability.Granularity granularity, Integer limit);
}
