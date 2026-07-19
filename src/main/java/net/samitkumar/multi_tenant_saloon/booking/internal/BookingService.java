package net.samitkumar.multi_tenant_saloon.booking.internal;

import net.samitkumar.multi_tenant_saloon.booking.AvailableSlot;
import net.samitkumar.multi_tenant_saloon.booking.Booking;
import net.samitkumar.multi_tenant_saloon.booking.BookingCreatedEvent;
import net.samitkumar.multi_tenant_saloon.booking.BookingRescheduledEvent;
import net.samitkumar.multi_tenant_saloon.booking.BookingStatus;
import net.samitkumar.multi_tenant_saloon.booking.BookingStatusChangedEvent;
import net.samitkumar.multi_tenant_saloon.booking.StaffAvailability;
import net.samitkumar.multi_tenant_saloon.booking.StaffAvailabilityOverride;
import net.samitkumar.multi_tenant_saloon.booking.StaffAvailabilityOverrideAddedEvent;
import net.samitkumar.multi_tenant_saloon.booking.StaffAvailabilityOverrideRemovedEvent;
import net.samitkumar.multi_tenant_saloon.booking.StaffScheduleUpdatedEvent;
import net.samitkumar.multi_tenant_saloon.saloonservice.SaloonServiceApi;
import net.samitkumar.multi_tenant_saloon.staff.StaffApi;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
class BookingService {

    private final BookingRepository bookingRepo;
    private final StaffAvailabilityRepository availabilityRepo;
    private final StaffAvailabilityOverrideRepository overrideRepo;
    private final SaloonServiceApi saloonServiceApi;
    private final StaffApi staffApi;
    private final ApplicationEventPublisher eventPublisher;

    BookingService(BookingRepository bookingRepo,
                   StaffAvailabilityRepository availabilityRepo,
                   StaffAvailabilityOverrideRepository overrideRepo,
                   SaloonServiceApi saloonServiceApi,
                   StaffApi staffApi,
                   ApplicationEventPublisher eventPublisher) {
        this.bookingRepo = bookingRepo;
        this.availabilityRepo = availabilityRepo;
        this.overrideRepo = overrideRepo;
        this.saloonServiceApi = saloonServiceApi;
        this.staffApi = staffApi;
        this.eventPublisher = eventPublisher;
    }

    // ── Availability ──────────────────────────────────────────────────────────

    List<StaffAvailability> getAvailability(UUID saloonId, Long staffId) {
        return availabilityRepo.findBySaloonIdAndStaffId(saloonId, staffId);
    }

    @Transactional
    List<StaffAvailability> setAvailability(UUID saloonId, Long staffId, List<StaffAvailability> schedule) {
        availabilityRepo.deleteBySaloonIdAndStaffId(saloonId, staffId);
        var saved = schedule.stream()
                .map(s -> new StaffAvailability(null, saloonId, staffId, s.dayOfWeek(), s.startTime(), s.endTime(), s.available()))
                .map(availabilityRepo::save)
                .toList();
        eventPublisher.publishEvent(new StaffScheduleUpdatedEvent(saloonId, staffId, saved.size()));
        return saved;
    }

    List<StaffAvailabilityOverride> getOverrides(UUID saloonId, Long staffId) {
        return overrideRepo.findBySaloonIdAndStaffId(saloonId, staffId);
    }

    StaffAvailabilityOverride addOverride(UUID saloonId, Long staffId, StaffAvailabilityOverride override) {
        var toSave = new StaffAvailabilityOverride(null, saloonId, staffId,
                override.overrideDate(), override.startTime(), override.endTime(),
                override.available(), override.reason());
        var saved = overrideRepo.save(toSave);
        eventPublisher.publishEvent(new StaffAvailabilityOverrideAddedEvent(
                saloonId, staffId, saved.id(), saved.overrideDate(),
                saved.startTime(), saved.endTime(), saved.available(), saved.reason()));
        return saved;
    }

    void removeOverride(UUID saloonId, Long staffId, Long overrideId) {
        overrideRepo.findById(overrideId)
                .filter(o -> o.saloonId().equals(saloonId) && o.staffId().equals(staffId))
                .ifPresent(o -> {
                    overrideRepo.deleteById(overrideId);
                    eventPublisher.publishEvent(new StaffAvailabilityOverrideRemovedEvent(
                            saloonId, staffId, overrideId, o.overrideDate()));
                });
    }

    // ── Slot calculation ──────────────────────────────────────────────────────

    List<AvailableSlot> findAvailableSlots(UUID saloonId, Long serviceId, LocalDate date, Long requestedStaffId) {
        var serviceItem = saloonServiceApi.findByIdAndSaloonId(serviceId, saloonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));

        int duration = serviceItem.durationMinutes();

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
                staffCandidates = staffApi.findAvailableForBookingBySaloonId(saloonId).stream()
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
                    overrideRepo.findBySaloonIdAndStaffIdAndOverrideDate(saloonId, staffId, date);

            if (override.isPresent()) {
                if (!override.get().available()) continue;
                windowStart = override.get().startTime();
                windowEnd = override.get().endTime();
            } else {
                Optional<StaffAvailability> avail =
                        availabilityRepo.findBySaloonIdAndStaffIdAndDayOfWeek(saloonId, staffId, dayOfWeek);
                if (avail.isEmpty() || !avail.get().available()) continue;
                windowStart = avail.get().startTime();
                windowEnd = avail.get().endTime();
            }

            List<Booking> existingBookings = bookingRepo.findActiveByStaffOnDate(saloonId, staffId, date);

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

    List<Booking> findAll(UUID saloonId) {
        return bookingRepo.findBySaloonId(saloonId);
    }

    Optional<Booking> findById(UUID saloonId, Long bookingId) {
        return bookingRepo.findBySaloonIdAndId(saloonId, bookingId);
    }

    @Transactional
    Booking create(UUID saloonId, Long serviceId, Long requestedStaffId,
                   String customerName, String customerEmail, String customerPhone,
                   LocalDate appointmentDate, LocalTime startTime, String notes) {

        var serviceItem = saloonServiceApi.findByIdAndSaloonId(serviceId, saloonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));

        Long staffId;
        if (requestedStaffId != null) {
            staffApi.findByIdAndSaloonId(requestedStaffId, saloonId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff member not found"));
            staffId = requestedStaffId;
        } else {
            var slots = findAvailableSlots(saloonId, serviceId, appointmentDate, null);
            staffId = slots.stream()
                    .filter(s -> s.startTime().equals(startTime))
                    .map(AvailableSlot::staffId)
                    .findFirst()
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "No available staff for requested slot"));
        }

        LocalTime endTime = startTime.plusMinutes(serviceItem.durationMinutes());

        boolean conflict = bookingRepo.findActiveByStaffOnDate(saloonId, staffId, appointmentDate)
                .stream().anyMatch(b -> startTime.isBefore(b.endTime()) && endTime.isAfter(b.startTime()));
        if (conflict) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Requested slot is no longer available");
        }

        var booking = new Booking(null, saloonId, serviceId, staffId,
                customerName, customerEmail, customerPhone,
                appointmentDate, startTime, endTime,
                BookingStatus.PENDING, notes, Instant.now());
        var saved = bookingRepo.save(booking);

        eventPublisher.publishEvent(new BookingCreatedEvent(
                saved.id(), saloonId, serviceId, staffId,
                customerName, customerEmail, customerPhone,
                appointmentDate, startTime, endTime));

        return saved;
    }

    Optional<Booking> updateStatus(UUID saloonId, Long bookingId, BookingStatus newStatus) {
        return bookingRepo.findBySaloonIdAndId(saloonId, bookingId).map(existing -> {
            var updated = new Booking(existing.id(), existing.saloonId(), existing.serviceId(),
                    existing.staffId(), existing.customerName(), existing.customerEmail(),
                    existing.customerPhone(), existing.appointmentDate(), existing.startTime(),
                    existing.endTime(), newStatus, existing.notes(), existing.createdAt());
            var saved = bookingRepo.save(updated);
            eventPublisher.publishEvent(new BookingStatusChangedEvent(
                    saved.id(), saloonId, newStatus,
                    saved.customerName(), saved.customerEmail(), saved.customerPhone(),
                    saved.appointmentDate(), saved.startTime(), saved.endTime()));
            return saved;
        });
    }

    Optional<Booking> reschedule(UUID saloonId, Long bookingId,
                                 LocalDate newDate, LocalTime newStartTime, Long newStaffId, String notes) {
        return bookingRepo.findBySaloonIdAndId(saloonId, bookingId).map(existing -> {
            var serviceItem = saloonServiceApi.findByIdAndSaloonId(existing.serviceId(), saloonId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));
            LocalTime newEndTime = newStartTime.plusMinutes(serviceItem.durationMinutes());
            Long staffId = newStaffId != null ? newStaffId : existing.staffId();

            var updated = new Booking(existing.id(), existing.saloonId(), existing.serviceId(),
                    staffId, existing.customerName(), existing.customerEmail(),
                    existing.customerPhone(), newDate, newStartTime, newEndTime,
                    existing.status(), notes != null ? notes : existing.notes(), existing.createdAt());
            var saved = bookingRepo.save(updated);
            eventPublisher.publishEvent(new BookingRescheduledEvent(
                    saved.id(), saloonId, staffId,
                    saved.customerName(), saved.customerEmail(), saved.customerPhone(),
                    newDate, newStartTime, newEndTime));
            return saved;
        });
    }

    void delete(UUID saloonId, Long bookingId) {
        bookingRepo.findBySaloonIdAndId(saloonId, bookingId)
                .ifPresent(b -> bookingRepo.deleteById(bookingId));
    }
}
