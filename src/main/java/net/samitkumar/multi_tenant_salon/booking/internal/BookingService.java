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
import net.samitkumar.multi_tenant_salon.booking.SalonAvailability;
import net.samitkumar.multi_tenant_salon.booking.StaffSchedule;
import net.samitkumar.multi_tenant_salon.booking.StaffScheduleUpdatedEvent;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonClosure;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.staff.StaffApi;
import net.samitkumar.multi_tenant_salon.staff.StaffMember;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
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
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private final JdbcClient jdbcClient;

    BookingService(BookingRepository bookingRepo,
                   StaffAvailabilityRepository availabilityRepo,
                   StaffAvailabilityOverrideRepository overrideRepo,
                   SalonServiceApi salonServiceApi,
                   StaffApi staffApi,
                   SalonApi salonApi,
                   ApplicationEventPublisher eventPublisher,
                   JdbcTemplate jdbcTemplate) {
        this.bookingRepo = bookingRepo;
        this.availabilityRepo = availabilityRepo;
        this.overrideRepo = overrideRepo;
        this.salonServiceApi = salonServiceApi;
        this.staffApi = staffApi;
        this.salonApi = salonApi;
        this.eventPublisher = eventPublisher;
        this.jdbcClient = JdbcClient.create(jdbcTemplate);
    }

    /**
     * Serialises every booking write for one staff member on one calendar date. Two requests
     * for the same slot arriving together would otherwise both pass the in-memory overlap
     * check below and both insert (Spring's default {@code READ_COMMITTED} can't see the
     * other transaction's uncommitted row). This takes a Postgres <em>transaction-scoped</em>
     * advisory lock keyed on {@code (staffId, epochDay)}: the first caller proceeds, any
     * concurrent caller for the same staff+date blocks until the first transaction commits or
     * rolls back, then re-runs its overlap check against the now-visible row and is rejected
     * with 409. The lock is released automatically at transaction end — no unlock call, and
     * it never leaks on error. Must be invoked inside the {@code @Transactional} method.
     */
    private void lockStaffDay(Long staffId, LocalDate date) {
        jdbcClient.sql("SELECT pg_advisory_xact_lock(:key1, :key2)")
                .param("key1", staffId.intValue())
                .param("key2", (int) date.toEpochDay())
                .query()
                .singleColumn();
    }

    private record SalonContact(String name, String phone, String email) {}

    private SalonContact salonContact(UUID salonId) {
        return salonApi.findById(salonId)
                .map(s -> new SalonContact(s.name(),
                        s.contact() != null ? s.contact().phone() : null,
                        s.contact() != null ? s.contact().email() : null))
                .orElse(new SalonContact(null, null, null));
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

    /**
     * The days this staff member is never bookable — same source of truth
     * {@link #findAvailableSlots} already checks per date, rolled up so a booking UI's calendar
     * can grey them out for this staff member up front instead of only after picking a date.
     */
    StaffSchedule findStaffSchedule(UUID salonId, Long staffId) {
        var openWeekdays = availabilityRepo.findBySalonIdAndStaffId(salonId, staffId).stream()
                .filter(StaffAvailability::available)
                .map(StaffAvailability::dayOfWeek)
                .collect(java.util.stream.Collectors.toSet());
        Set<DayOfWeek> closedWeekdays = EnumSet.allOf(DayOfWeek.class);
        closedWeekdays.removeAll(openWeekdays);

        var closedDates = overrideRepo.findBySalonIdAndStaffId(salonId, staffId).stream()
                .filter(o -> !o.available())
                .map(StaffAvailabilityOverride::overrideDate)
                .toList();

        return new StaffSchedule(closedWeekdays, closedDates);
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

    // ── Flexible availability query ───────────────────────────────────────────

    /** Hard ceiling on the scanned span, whatever {@code from}/{@code to}/advance-days say. */
    private static final int MAX_RANGE_DAYS = 92;

    /**
     * One query that answers day-level and slot-level availability across a date range, optionally
     * scoped to a service and/or a stylist. See {@link SalonAvailability}.
     *
     * @param serviceId   service to size slots by and (with no {@code staffId}) to pick candidate
     *                     stylists from; {@code null} falls back to the default duration + all
     *                     bookable staff
     * @param staffId     restrict to this stylist; {@code null} considers every candidate
     * @param from        first date to scan; {@code null} or past → today
     * @param to          last date to scan; {@code null} → {@code from} + the salon's booking
     *                     advance window; the span is capped at {@value #MAX_RANGE_DAYS} days
     * @param granularity {@code SLOT} also fills {@link SalonAvailability.DayAvailability#slots()}
     * @param limit       when set, {@code days} holds only the first {@code limit} OPEN days
     */
    SalonAvailability queryAvailability(UUID salonId, Long serviceId, Long staffId,
                                       LocalDate from, LocalDate to,
                                       SalonAvailability.Granularity granularity, Integer limit) {
        var today = LocalDate.now();
        LocalDate start = (from == null || from.isBefore(today)) ? today : from;

        var salon = salonApi.findById(salonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Salon not found"));
        int advanceDays = salon.bookingAdvanceDays() != null ? salon.bookingAdvanceDays() : 60;
        LocalDate end = (to == null) ? start.plusDays(advanceDays) : to;
        if (end.isBefore(start)) {
            end = start;
        }
        if (java.time.temporal.ChronoUnit.DAYS.between(start, end) > MAX_RANGE_DAYS) {
            end = start.plusDays(MAX_RANGE_DAYS);
        }

        String serviceName = null;
        int duration = DEFAULT_DURATION_MINUTES;
        List<Long> candidates;
        if (serviceId != null) {
            var service = salonServiceApi.findByIdAndSalonId(serviceId, salonId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));
            serviceName = service.name();
            if (service.durationMinutes() != null) {
                duration = service.durationMinutes();
            }
            candidates = service.assignedStaffIds().stream()
                    .map(s -> s.staffId())
                    .filter(id -> id != null && id.matches("\\d+"))
                    .map(Long::parseLong)
                    .collect(Collectors.toList());
        } else {
            candidates = new ArrayList<>();
        }
        if (staffId != null) {
            staffApi.findByIdAndSalonId(staffId, salonId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff member not found"));
            candidates = List.of(staffId);
        } else if (candidates.isEmpty()) {
            candidates = staffApi.findAvailableForBookingBySalonId(salonId).stream().map(m -> m.id()).toList();
        }

        // ── Pre-fetch everything the per-day loop needs, once ──
        var closures = salonApi.findClosures(salonId);
        var operatingHours = salonApi.findOperatingHours(salonId);
        Set<DayOfWeek> salonClosedWeekdays = operatingHours.isEmpty()
                ? EnumSet.noneOf(DayOfWeek.class)
                : operatingHours.stream().filter(Salon.OperatingHours::closed)
                    .map(Salon.OperatingHours::day).collect(Collectors.toCollection(() -> EnumSet.noneOf(DayOfWeek.class)));
        boolean hoursConfigured = !operatingHours.isEmpty();
        Set<DayOfWeek> weekdaysWithHours = operatingHours.stream()
                .map(Salon.OperatingHours::day).collect(Collectors.toCollection(() -> EnumSet.noneOf(DayOfWeek.class)));

        // recurring weekly windows: staffId -> weekday -> [start, end]  (only `available` rows)
        Map<Long, Map<DayOfWeek, LocalTime[]>> weekly = new HashMap<>();
        for (StaffAvailability a : availabilityRepo.findBySalonId(salonId)) {
            if (a.available() && candidates.contains(a.staffId())) {
                weekly.computeIfAbsent(a.staffId(), k -> new HashMap<>())
                        .put(a.dayOfWeek(), new LocalTime[]{a.startTime(), a.endTime()});
            }
        }
        // one-off overrides: staffId -> date -> override
        Map<Long, Map<LocalDate, StaffAvailabilityOverride>> overrides = new HashMap<>();
        for (StaffAvailabilityOverride o : overrideRepo.findBySalonId(salonId)) {
            if (candidates.contains(o.staffId())) {
                overrides.computeIfAbsent(o.staffId(), k -> new HashMap<>()).put(o.overrideDate(), o);
            }
        }
        // active bookings in range: staffId -> date -> bookings
        Map<Long, Map<LocalDate, List<Booking>>> booked = new HashMap<>();
        for (Booking b : bookingRepo.findActiveBySalonBetween(salonId, start, end)) {
            booked.computeIfAbsent(b.staffId(), k -> new HashMap<>())
                    .computeIfAbsent(b.appointmentDate(), k -> new ArrayList<>()).add(b);
        }

        var days = new ArrayList<SalonAvailability.DayAvailability>();
        SalonAvailability.FirstAvailable firstAvailable = null;
        int openDaysAdded = 0;
        final int step = duration;

        for (LocalDate day : start.datesUntil(end.plusDays(1)).toList()) {
            if (limit != null && openDaysAdded >= limit) {
                break;
            }
            DayOfWeek dow = day.getDayOfWeek();

            // 1. Salon-wide closed — holiday / one-off closure (named), or a non-working weekday.
            var closure = closures.stream()
                    .filter(c -> !day.isBefore(c.startDate()) && !day.isAfter(c.endDate()))
                    .map(SalonClosure::reason).filter(r -> r != null && !r.isBlank())
                    .findFirst();
            String closedReason = null;
            if (closure.isPresent()) {
                closedReason = closure.get();
            } else if (hoursConfigured && (salonClosedWeekdays.contains(dow) || !weekdaysWithHours.contains(dow))) {
                closedReason = "The salon is closed on " + prettyPlural(dow) + ".";
            } else if (salonApi.isClosedOn(salonId, day)) {
                closedReason = "The salon is closed that day.";
            }
            if (closedReason != null) {
                days.add(new SalonAvailability.DayAvailability(
                        day, dow, SalonAvailability.DayStatus.SALON_CLOSED, closedReason,
                        0, null, List.of(), granularity == SalonAvailability.Granularity.SLOT ? List.of() : null));
                continue;
            }

            // 2. Per-stylist working windows + slot generation.
            var daySlots = new ArrayList<AvailableSlot>();
            boolean anyStylistWorking = false;
            for (Long sid : candidates) {
                LocalTime[] window = windowFor(sid, day, dow, weekly, overrides);
                if (window == null) {
                    continue;
                }
                anyStylistWorking = true;
                var existing = booked.getOrDefault(sid, Map.of()).getOrDefault(day, List.of());
                LocalTime cur = window[0];
                while (!cur.plusMinutes(step).isAfter(window[1])) {
                    LocalTime slotEnd = cur.plusMinutes(step);
                    final LocalTime slotStart = cur;
                    boolean taken = existing.stream().anyMatch(b ->
                            slotStart.isBefore(b.endTime()) && slotEnd.isAfter(b.startTime()));
                    daySlots.add(new AvailableSlot(sid, slotStart, slotEnd, taken));
                    cur = cur.plusMinutes(step);
                }
            }

            var free = daySlots.stream().filter(s -> !s.booked())
                    .sorted(Comparator.comparing(AvailableSlot::startTime).thenComparing(AvailableSlot::staffId))
                    .toList();

            SalonAvailability.DayStatus status;
            String reason = null;
            if (!anyStylistWorking) {
                status = SalonAvailability.DayStatus.STAFF_OFF;
                reason = staffId != null
                        ? "That stylist isn't working on " + prettyPlural(dow) + "."
                        : "No stylist is scheduled to work on " + prettyPlural(dow) + ".";
            } else if (free.isEmpty()) {
                status = SalonAvailability.DayStatus.FULLY_BOOKED;
                reason = "Every slot that day is already booked.";
            } else {
                status = SalonAvailability.DayStatus.OPEN;
            }

            List<Long> openStaff = free.stream().map(AvailableSlot::staffId).distinct().toList();
            List<AvailableSlot> slotView = null;
            if (granularity == SalonAvailability.Granularity.SLOT) {
                slotView = daySlots.stream()
                        .sorted(Comparator.comparing(AvailableSlot::startTime).thenComparing(AvailableSlot::staffId))
                        .toList();
            }

            if (status == SalonAvailability.DayStatus.OPEN) {
                openDaysAdded++;
                if (firstAvailable == null) {
                    var f = free.get(0);
                    firstAvailable = new SalonAvailability.FirstAvailable(day, f.startTime(), f.staffId());
                }
            } else if (limit != null) {
                // limit counts OPEN days only — don't emit the blocked ones in a limited view.
                continue;
            }

            days.add(new SalonAvailability.DayAvailability(
                    day, dow, status, reason,
                    free.size(), free.isEmpty() ? null : free.get(0).startTime(),
                    openStaff, slotView));
        }

        return new SalonAvailability(serviceId, serviceName, duration, staffId, start, end, days, firstAvailable);
    }

    /** The stylist's bookable window for a date: a one-off override wins over the weekly row; {@code null} = not working. */
    private static LocalTime[] windowFor(Long staffId, LocalDate date, DayOfWeek dow,
                                         Map<Long, Map<DayOfWeek, LocalTime[]>> weekly,
                                         Map<Long, Map<LocalDate, StaffAvailabilityOverride>> overrides) {
        var override = overrides.getOrDefault(staffId, Map.of()).get(date);
        if (override != null) {
            return (override.available() && override.startTime() != null && override.endTime() != null)
                    ? new LocalTime[]{override.startTime(), override.endTime()}
                    : null;
        }
        return weekly.getOrDefault(staffId, Map.of()).get(dow);
    }

    private static String prettyPlural(DayOfWeek dow) {
        return dow.getDisplayName(java.time.format.TextStyle.FULL, java.util.Locale.ENGLISH) + "s";
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

        // Hold a per-(staff, date) lock across the overlap check + insert so two simultaneous
        // requests for the same slot can't both slip through — the loser blocks here, then sees
        // the winner's row below and gets a 409.
        lockStaffDay(staffId, appointmentDate);

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
        var salon = salonContact(salonId);
        eventPublisher.publishEvent(new BookingCreatedEvent(
                saved.id(), salonId, serviceId, staffId,
                customerName, customerEmail, customerPhone,
                appointmentDate, startTime, endTime, initialStatus,
                salon.name(), salon.phone(), salon.email()));

        staffApi.findByIdAndSalonId(staffId, salonId).ifPresent(staff ->
                eventPublisher.publishEvent(new StaffBookingAssignedEvent(
                        saved.id(), salonId, staffId, staff.name(), staff.email(),
                        serviceId, customerName, appointmentDate, startTime, endTime)));

        return saved;
    }

    @Transactional
    Optional<Booking> updateStatus(UUID salonId, Long bookingId, BookingStatus newStatus) {
        log.info("[BookingService] Updating booking id={} salon={} status={}", bookingId, salonId, newStatus);
        return bookingRepo.findBySalonIdAndId(salonId, bookingId).map(existing -> {
            var updated = new Booking(existing.id(), existing.salonId(), existing.serviceId(),
                    existing.staffId(), existing.customerName(), existing.customerEmail(),
                    existing.customerPhone(), existing.appointmentDate(), existing.startTime(),
                    existing.endTime(), newStatus, existing.notes(), existing.createdAt());
            var saved = bookingRepo.save(updated);
            var salon = salonContact(salonId);
            eventPublisher.publishEvent(new BookingStatusChangedEvent(
                    saved.id(), salonId, newStatus,
                    saved.customerName(), saved.customerEmail(), saved.customerPhone(),
                    saved.appointmentDate(), saved.startTime(), saved.endTime(),
                    salon.name(), salon.phone(), salon.email()));
            return saved;
        });
    }

    @Transactional
    Optional<Booking> reschedule(UUID salonId, Long bookingId,
                                 LocalDate newDate, LocalTime newStartTime, Long newStaffId, String notes) {
        log.info("[BookingService] Rescheduling booking id={} salon={} newDate={} newTime={}", bookingId, salonId, newDate, newStartTime);
        return bookingRepo.findBySalonIdAndId(salonId, bookingId).map(existing -> {
            var serviceItem = salonServiceApi.findByIdAndSalonId(existing.serviceId(), salonId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service not found"));
            LocalTime newEndTime = newStartTime.plusMinutes(serviceItem.durationMinutes() != null ? serviceItem.durationMinutes() : DEFAULT_DURATION_MINUTES);
            Long staffId = newStaffId != null ? newStaffId : existing.staffId();

            // Same guard as create(): lock the target (staff, date) then check for an overlap
            // with any other active booking so a reschedule can't be raced onto a taken slot.
            lockStaffDay(staffId, newDate);
            boolean clash = bookingRepo.findActiveByStaffOnDate(salonId, staffId, newDate).stream()
                    .filter(b -> !b.id().equals(existing.id()))
                    .anyMatch(b -> newStartTime.isBefore(b.endTime()) && newEndTime.isAfter(b.startTime()));
            if (clash) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Requested slot is no longer available");
            }

            var updated = new Booking(existing.id(), existing.salonId(), existing.serviceId(),
                    staffId, existing.customerName(), existing.customerEmail(),
                    existing.customerPhone(), newDate, newStartTime, newEndTime,
                    existing.status(), notes != null ? notes : existing.notes(), existing.createdAt());
            var saved = bookingRepo.save(updated);
            var salon = salonContact(salonId);
            eventPublisher.publishEvent(new BookingRescheduledEvent(
                    saved.id(), salonId, staffId,
                    saved.customerName(), saved.customerEmail(), saved.customerPhone(),
                    newDate, newStartTime, newEndTime,
                    salon.name(), salon.phone(), salon.email()));

            if (!staffId.equals(existing.staffId())) {
                staffApi.findByIdAndSalonId(staffId, salonId).ifPresent(staff ->
                        eventPublisher.publishEvent(new StaffBookingAssignedEvent(
                                saved.id(), salonId, staffId, staff.name(), staff.email(),
                                saved.serviceId(), saved.customerName(), newDate, newStartTime, newEndTime)));
            }

            return saved;
        });
    }

    @Transactional
    void delete(UUID salonId, Long bookingId) {
        log.info("[BookingService] Deleting booking id={} salon={}", bookingId, salonId);
        bookingRepo.findBySalonIdAndId(salonId, bookingId).ifPresent(b -> {
            bookingRepo.deleteById(bookingId);
            var salon = salonContact(salonId);
            eventPublisher.publishEvent(new BookingStatusChangedEvent(
                    b.id(), salonId, BookingStatus.CANCELLED,
                    b.customerName(), b.customerEmail(), b.customerPhone(),
                    b.appointmentDate(), b.startTime(), b.endTime(),
                    salon.name(), salon.phone(), salon.email()));
        });
    }
}
