package net.samitkumar.multi_tenant_salon.booking.internal;

import net.samitkumar.multi_tenant_salon.booking.AvailableSlot;
import net.samitkumar.multi_tenant_salon.booking.Booking;
import net.samitkumar.multi_tenant_salon.booking.BookingApi;
import net.samitkumar.multi_tenant_salon.booking.BookingCreatedEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingRescheduledEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import net.samitkumar.multi_tenant_salon.booking.BookingStatusChangedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailability;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverride;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverrideAddedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverrideRemovedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffBookingAssignedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffScheduleUpdatedEvent;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.staff.StaffApi;
import net.samitkumar.multi_tenant_salon.staff.StaffMember;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
class BookingService implements BookingApi {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("H:mm");
    private static final int DEFAULT_DURATION_MINUTES = 30;

    private final BookingRepository bookingRepo;
    private final StaffAvailabilityRepository availabilityRepo;
    private final StaffAvailabilityOverrideRepository overrideRepo;
    private final SalonServiceApi salonServiceApi;
    private final StaffApi staffApi;
    private final SalonApi salonApi;
    private final ApplicationEventPublisher eventPublisher;

    BookingService(BookingRepository bookingRepo,
                   StaffAvailabilityRepository availabilityRepo,
                   StaffAvailabilityOverrideRepository overrideRepo,
                   SalonServiceApi salonServiceApi,
                   StaffApi staffApi,
                   SalonApi salonApi,
                   ApplicationEventPublisher eventPublisher) {
        this.bookingRepo = bookingRepo;
        this.availabilityRepo = availabilityRepo;
        this.overrideRepo = overrideRepo;
        this.salonServiceApi = salonServiceApi;
        this.staffApi = staffApi;
        this.salonApi = salonApi;
        this.eventPublisher = eventPublisher;
    }

    private void validateAgainstSalonHours(UUID salonId, DayOfWeek day, LocalTime start, LocalTime end) {
        var hours = salonApi.findOperatingHours(salonId);
        if (hours.isEmpty()) return; // no hours configured — no restriction

        Salon.OperatingHours oh = hours.stream()
                .filter(h -> h.day() == day)
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Salon has no operating hours defined for " + day));

        if (oh.closed()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Salon is closed on " + day + " — staff cannot be scheduled that day");
        }

        LocalTime salonOpen  = LocalTime.parse(oh.openTime(),  TIME_FMT);
        LocalTime salonClose = LocalTime.parse(oh.closeTime(), TIME_FMT);

        if (start.isBefore(salonOpen) || end.isAfter(salonClose)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Staff hours for " + day + " must be within salon operating hours ("
                    + oh.openTime() + " – " + oh.closeTime() + ")");
        }
    }

    // ── Availability ──────────────────────────────────────────────────────────

    List<StaffAvailability> getAvailability(UUID salonId, Long staffId) {
        return availabilityRepo.findBySalonIdAndStaffId(salonId, staffId);
    }

    @Transactional
    List<StaffAvailability> setAvailability(UUID salonId, Long staffId, List<StaffAvailability> schedule) {
        log.info("[BookingService] Setting availability for salon={} staff={} entries={}", salonId, staffId, schedule.size());
        schedule.stream()
                .filter(StaffAvailability::available)
                .forEach(s -> validateAgainstSalonHours(salonId, s.dayOfWeek(), s.startTime(), s.endTime()));

        availabilityRepo.deleteBySalonIdAndStaffId(salonId, staffId);
        var saved = schedule.stream()
                .map(s -> new StaffAvailability(null, salonId, staffId, s.dayOfWeek(), s.startTime(), s.endTime(), s.available()))
                .map(availabilityRepo::save)
                .toList();
        var staff = staffApi.findByIdAndSalonId(staffId, salonId);
        eventPublisher.publishEvent(new StaffScheduleUpdatedEvent(
                salonId, staffId, staff.map(StaffMember::name).orElse(null), staff.map(StaffMember::email).orElse(null),
                saved.size()));
        return saved;
    }

    @Override
    public List<Booking> findByStaff(UUID salonId, Long staffId) {
        return bookingRepo.findBySalonIdAndStaffId(salonId, staffId);
    }

    @Override
    public List<StaffAvailabilityOverride> getOverrides(UUID salonId, Long staffId) {
        return overrideRepo.findBySalonIdAndStaffId(salonId, staffId);
    }

    @Override
    public StaffAvailabilityOverride addOverride(UUID salonId, Long staffId, StaffAvailabilityOverride override) {
        log.info("[BookingService] Adding availability override for salon={} staff={} date={}", salonId, staffId, override.overrideDate());
        if (override.available() && override.startTime() != null && override.endTime() != null) {
            validateAgainstSalonHours(salonId,
                    override.overrideDate().getDayOfWeek(),
                    override.startTime(), override.endTime());
        }

        var toSave = new StaffAvailabilityOverride(null, salonId, staffId,
                override.overrideDate(), override.startTime(), override.endTime(),
                override.available(), override.reason());
        var saved = overrideRepo.save(toSave);
        var staff = staffApi.findByIdAndSalonId(staffId, salonId);
        eventPublisher.publishEvent(new StaffAvailabilityOverrideAddedEvent(
                salonId, staffId, staff.map(StaffMember::name).orElse(null), staff.map(StaffMember::email).orElse(null),
                saved.id(), saved.overrideDate(),
                saved.startTime(), saved.endTime(), saved.available(), saved.reason()));
        return saved;
    }

    @Override
    public void removeOverride(UUID salonId, Long staffId, Long overrideId) {
        log.info("[BookingService] Removing availability override id={} for salon={} staff={}", overrideId, salonId, staffId);
        overrideRepo.findById(overrideId)
                .filter(o -> o.salonId().equals(salonId) && o.staffId().equals(staffId))
                .ifPresent(o -> {
                    overrideRepo.deleteById(overrideId);
                    var staff = staffApi.findByIdAndSalonId(staffId, salonId);
                    eventPublisher.publishEvent(new StaffAvailabilityOverrideRemovedEvent(
                            salonId, staffId, staff.map(StaffMember::name).orElse(null), staff.map(StaffMember::email).orElse(null),
                            overrideId, o.overrideDate()));
                });
    }

    // ── Slot calculation ──────────────────────────────────────────────────────

    List<AvailableSlot> findAvailableSlots(UUID salonId, Long serviceId, LocalDate date, Long requestedStaffId) {
        if (salonApi.isClosedOn(salonId, date)) {
            return List.of();
        }

        var serviceItem = salonServiceApi.findByIdAndSalonId(serviceId, salonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));

        int duration = serviceItem.durationMinutes() != null ? serviceItem.durationMinutes() : DEFAULT_DURATION_MINUTES;

        List<Long> staffCandidates;
        if (requestedStaffId != null) {
            staffCandidates = List.of(requestedStaffId);
        } else {
            staffCandidates = serviceItem.assignedStaffIds().stream()
                    .map(s -> s.staffId())
                    .filter(id -> id != null && id.matches("\\d+"))
                    .map(Long::parseLong)
                    .collect(java.util.stream.Collectors.toList());
            if (staffCandidates.isEmpty()) {
                staffCandidates = staffApi.findAvailableForBookingBySalonId(salonId).stream()
                        .map(m -> m.id())
                        .toList();
            }
        }

        DayOfWeek dayOfWeek = date.getDayOfWeek();
        List<AvailableSlot> result = new ArrayList<>();

        for (Long staffId : staffCandidates) {
            LocalTime windowStart;
            LocalTime windowEnd;

            Optional<StaffAvailabilityOverride> override =
                    overrideRepo.findBySalonIdAndStaffIdAndOverrideDate(salonId, staffId, date);

            if (override.isPresent()) {
                if (!override.get().available()) continue;
                windowStart = override.get().startTime();
                windowEnd = override.get().endTime();
            } else {
                Optional<StaffAvailability> avail =
                        availabilityRepo.findBySalonIdAndStaffIdAndDayOfWeek(salonId, staffId, dayOfWeek);
                if (avail.isEmpty() || !avail.get().available()) continue;
                windowStart = avail.get().startTime();
                windowEnd = avail.get().endTime();
            }

            List<Booking> existingBookings = bookingRepo.findActiveByStaffOnDate(salonId, staffId, date);

            LocalTime current = windowStart;
            while (!current.plusMinutes(duration).isAfter(windowEnd)) {
                LocalTime slotEnd = current.plusMinutes(duration);
                final LocalTime slotStart = current;
                boolean conflict = existingBookings.stream().anyMatch(b ->
                        slotStart.isBefore(b.endTime()) && slotEnd.isAfter(b.startTime()));
                result.add(new AvailableSlot(staffId, slotStart, slotEnd, conflict));
                current = current.plusMinutes(duration);
            }
        }

        return result.stream()
                .sorted(Comparator.comparing(AvailableSlot::startTime).thenComparing(AvailableSlot::staffId))
                .toList();
    }

    // ── Bookings ──────────────────────────────────────────────────────────────

    List<Booking> findAll(UUID salonId) {
        return bookingRepo.findBySalonId(salonId);
    }

    Optional<Booking> findById(UUID salonId, Long bookingId) {
        return bookingRepo.findBySalonIdAndId(salonId, bookingId);
    }

    @Transactional
    Booking create(UUID salonId, Long serviceId, Long requestedStaffId,
                   String customerName, String customerEmail, String customerPhone,
                   LocalDate appointmentDate, LocalTime startTime, String notes) {
        log.info("[BookingService] Creating booking for salon={} service={} customer='{}' date={} time={}", salonId, serviceId, customerEmail, appointmentDate, startTime);
        if (salonApi.isClosedOn(salonId, appointmentDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Salon is closed on " + appointmentDate + " — no bookings can be made for this date");
        }

        var serviceItem = salonServiceApi.findByIdAndSalonId(serviceId, salonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));

        Long staffId;
        if (requestedStaffId != null) {
            staffApi.findByIdAndSalonId(requestedStaffId, salonId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff member not found"));
            staffId = requestedStaffId;
        } else {
            var slots = findAvailableSlots(salonId, serviceId, appointmentDate, null);
            staffId = slots.stream()
                    .filter(s -> s.startTime().equals(startTime))
                    .map(AvailableSlot::staffId)
                    .findFirst()
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "No available staff for requested slot"));
        }

        LocalTime endTime = startTime.plusMinutes(serviceItem.durationMinutes() != null ? serviceItem.durationMinutes() : DEFAULT_DURATION_MINUTES);

        boolean conflict = bookingRepo.findActiveByStaffOnDate(salonId, staffId, appointmentDate)
                .stream().anyMatch(b -> startTime.isBefore(b.endTime()) && endTime.isAfter(b.startTime()));
        if (conflict) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Requested slot is no longer available");
        }

        var initialStatus = salonApi.bookingRequiresConfirmation(salonId)
                ? BookingStatus.PENDING
                : BookingStatus.CONFIRMED;
        var booking = new Booking(null, salonId, serviceId, staffId,
                customerName, customerEmail, customerPhone,
                appointmentDate, startTime, endTime,
                initialStatus, notes, Instant.now());
        var saved = bookingRepo.save(booking);
        log.info("[BookingService] Booking created id={} status={} staff={}", saved.id(), saved.status(), staffId);
        eventPublisher.publishEvent(new BookingCreatedEvent(
                saved.id(), salonId, serviceId, staffId,
                customerName, customerEmail, customerPhone,
                appointmentDate, startTime, endTime, initialStatus));

        staffApi.findByIdAndSalonId(staffId, salonId).ifPresent(staff ->
                eventPublisher.publishEvent(new StaffBookingAssignedEvent(
                        saved.id(), salonId, staffId, staff.name(), staff.email(),
                        serviceId, customerName, appointmentDate, startTime, endTime)));

        return saved;
    }

    Optional<Booking> updateStatus(UUID salonId, Long bookingId, BookingStatus newStatus) {
        log.info("[BookingService] Updating booking id={} salon={} status={}", bookingId, salonId, newStatus);
        return bookingRepo.findBySalonIdAndId(salonId, bookingId).map(existing -> {
            var updated = new Booking(existing.id(), existing.salonId(), existing.serviceId(),
                    existing.staffId(), existing.customerName(), existing.customerEmail(),
                    existing.customerPhone(), existing.appointmentDate(), existing.startTime(),
                    existing.endTime(), newStatus, existing.notes(), existing.createdAt());
            var saved = bookingRepo.save(updated);
            eventPublisher.publishEvent(new BookingStatusChangedEvent(
                    saved.id(), salonId, newStatus,
                    saved.customerName(), saved.customerEmail(), saved.customerPhone(),
                    saved.appointmentDate(), saved.startTime(), saved.endTime()));
            return saved;
        });
    }

    Optional<Booking> reschedule(UUID salonId, Long bookingId,
                                 LocalDate newDate, LocalTime newStartTime, Long newStaffId, String notes) {
        log.info("[BookingService] Rescheduling booking id={} salon={} newDate={} newTime={}", bookingId, salonId, newDate, newStartTime);
        return bookingRepo.findBySalonIdAndId(salonId, bookingId).map(existing -> {
            var serviceItem = salonServiceApi.findByIdAndSalonId(existing.serviceId(), salonId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));
            LocalTime newEndTime = newStartTime.plusMinutes(serviceItem.durationMinutes() != null ? serviceItem.durationMinutes() : DEFAULT_DURATION_MINUTES);
            Long staffId = newStaffId != null ? newStaffId : existing.staffId();

            var updated = new Booking(existing.id(), existing.salonId(), existing.serviceId(),
                    staffId, existing.customerName(), existing.customerEmail(),
                    existing.customerPhone(), newDate, newStartTime, newEndTime,
                    existing.status(), notes != null ? notes : existing.notes(), existing.createdAt());
            var saved = bookingRepo.save(updated);
            eventPublisher.publishEvent(new BookingRescheduledEvent(
                    saved.id(), salonId, staffId,
                    saved.customerName(), saved.customerEmail(), saved.customerPhone(),
                    newDate, newStartTime, newEndTime));

            if (!staffId.equals(existing.staffId())) {
                staffApi.findByIdAndSalonId(staffId, salonId).ifPresent(staff ->
                        eventPublisher.publishEvent(new StaffBookingAssignedEvent(
                                saved.id(), salonId, staffId, staff.name(), staff.email(),
                                saved.serviceId(), saved.customerName(), newDate, newStartTime, newEndTime)));
            }

            return saved;
        });
    }

    void delete(UUID salonId, Long bookingId) {
        log.info("[BookingService] Deleting booking id={} salon={}", bookingId, salonId);
        bookingRepo.findBySalonIdAndId(salonId, bookingId).ifPresent(b -> {
            bookingRepo.deleteById(bookingId);
            eventPublisher.publishEvent(new BookingStatusChangedEvent(
                    b.id(), salonId, BookingStatus.CANCELLED,
                    b.customerName(), b.customerEmail(), b.customerPhone(),
                    b.appointmentDate(), b.startTime(), b.endTime()));
        });
    }
}
