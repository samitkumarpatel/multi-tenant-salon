package net.samitkumar.multi_tenant_salon.booking;

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
    List<StaffAvailabilityOverride> getOverrides(UUID salonId, Long staffId);
    StaffAvailabilityOverride addOverride(UUID salonId, Long staffId, StaffAvailabilityOverride override);
    void removeOverride(UUID salonId, Long staffId, Long overrideId);
    List<AvailableSlot> findAvailableSlots(UUID salonId, Long serviceId, LocalDate date, Long staffId);
    SalonAvailability queryAvailability(UUID salonId, Long serviceId, Long staffId, LocalDate from, LocalDate to,
                                        SalonAvailability.Granularity granularity, Integer limit);
}
