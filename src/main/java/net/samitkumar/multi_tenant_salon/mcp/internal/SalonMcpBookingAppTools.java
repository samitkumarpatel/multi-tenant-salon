package net.samitkumar.multi_tenant_salon.mcp.internal;

import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.spec.McpSchema;
import net.samitkumar.multi_tenant_salon.booking.BookingApi;
import net.samitkumar.multi_tenant_salon.booking.SalonAvailability;
import net.samitkumar.multi_tenant_salon.mcp.internal.SalonMcpSupport.SalonRef;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import net.samitkumar.multi_tenant_salon.staff.StaffApi;
import net.samitkumar.multi_tenant_salon.staff.StaffMember;
import net.samitkumar.multi_tenant_salon.staff.StaffStatus;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static net.samitkumar.multi_tenant_salon.mcp.internal.SalonMcpSupport.nullableMap;

/**
 * The three booking MCP Apps. Each reads real availability through {@link BookingApi} and lets the
 * visitor finish the booking in the app via the app-only {@code create_customer_booking} tool:
 * <ul>
 *   <li>{@code salon_booking} — step-by-step wizard with a month calendar;</li>
 *   <li>{@code salon_booking_by_stylist} — stylist first, then their working days and times;</li>
 *   <li>{@code salon_booking_week} — a seven-day grid of open times, week by week.</li>
 * </ul>
 */
@Component
class SalonMcpBookingAppTools {
    static final String BOOKING = "salon_booking";
    static final String BY_STYLIST = "salon_booking_by_stylist";
    static final String WEEK = "salon_booking_week";

    /** How many days the stylist app's day strip shows per page. */
    private static final int STYLIST_DAYS = 14;

    private final SalonMcpSupport support;
    private final SalonServiceApi services;
    private final StaffApi staff;
    private final BookingApi bookings;

    SalonMcpBookingAppTools(SalonMcpSupport support, SalonServiceApi services, StaffApi staff, BookingApi bookings) {
        this.support = support;
        this.services = services;
        this.staff = staff;
        this.bookings = bookings;
    }

    @McpTool(
            name = BOOKING,
            title = "Book an appointment",
            description = "Open the salon's step-by-step booking app: choose a service, optionally a stylist, a date on a month calendar that marks open/closed/fully-booked days, then a real open time, enter contact details and confirm. Pass serviceId, staffId, month (yyyy-MM) or date (yyyy-MM-dd) to start further along. The visitor confirms the booking themselves inside the app.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, destructiveHint = false, openWorldHint = false),
            metaProvider = SalonMcpAppMeta.BookingTool.class
    )
    McpSchema.CallToolResult booking(
            @McpToolParam(required = false, description = SalonMcpSupport.SALON_PARAM) String salonIdOrHandler,
            @McpToolParam(required = false, description = "Service id to book") Long serviceId,
            @McpToolParam(required = false, description = "Preferred stylist id; omit for any stylist") Long staffId,
            @McpToolParam(required = false, description = "Calendar month to show, yyyy-MM") String month,
            @McpToolParam(required = false, description = "Date whose open times to show, yyyy-MM-dd") String date,
            McpTransportContext transport) {
        return support.run("Booking is temporarily unavailable. Please try again.", () -> {
            SalonRef salon = support.bookableSalon(salonIdOrHandler, transport);
            Map<String, Object> data = support.base(BOOKING, "booking", salon);
            putChoices(data, salon);
            LocalDate selectedDate = withinWindow(salon, SalonMcpSupport.parseDate(date, "the date"));
            YearMonth shownMonth = parseMonth(month, selectedDate);
            data.put("month", shownMonth.toString());
            if (staffId != null) data.put("staffId", requireStaff(salon, staffId).id());
            if (serviceId == null) return data;

            ServiceItem service = requireService(salon, serviceId);
            data.put("serviceId", service.id());
            LocalDate from = max(shownMonth.atDay(1), LocalDate.now());
            LocalDate to = min(shownMonth.atEndOfMonth(), salon.lastBookableDate());
            data.put("days", from.isAfter(to) ? List.of() : SalonMcpSupport.dayMaps(
                    bookings.queryAvailability(salon.id(), service.id(), staffId, from, to, SalonAvailability.Granularity.DAY, null)));
            if (selectedDate != null) {
                data.put("date", selectedDate.toString());
                data.put("slots", slotsFor(salon, service, staffId, selectedDate));
            }
            return data;
        });
    }

    @McpTool(
            name = BY_STYLIST,
            title = "Book by stylist",
            description = "Open the booking-by-stylist app: the visitor picks a stylist (with photo, role and specialisations), sees the services that stylist performs and a two-week strip of the days they work, then picks an open time and confirms. Pass staffId to open on one stylist, plus serviceId/date to go further.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, destructiveHint = false, openWorldHint = false),
            metaProvider = SalonMcpAppMeta.BookingStylistTool.class
    )
    McpSchema.CallToolResult bookingByStylist(
            @McpToolParam(required = false, description = SalonMcpSupport.SALON_PARAM) String salonIdOrHandler,
            @McpToolParam(required = false, description = "Stylist id") Long staffId,
            @McpToolParam(required = false, description = "Service id") Long serviceId,
            @McpToolParam(required = false, description = "First day of the day strip, yyyy-MM-dd (defaults to today)") String from,
            @McpToolParam(required = false, description = "Date whose open times to show, yyyy-MM-dd") String date,
            McpTransportContext transport) {
        return support.run("Booking is temporarily unavailable. Please try again.", () -> {
            SalonRef salon = support.bookableSalon(salonIdOrHandler, transport);
            Map<String, Object> data = support.base(BY_STYLIST, "booking-stylist", salon);
            putChoices(data, salon);
            if (staffId == null) return data;

            StaffMember stylist = requireStaff(salon, staffId);
            data.put("staffId", stylist.id());
            data.put("stylistServiceIds", activeServices(salon).stream()
                    .filter(s -> SalonMcpSupport.offeredBy(s, stylist.id())).map(ServiceItem::id).toList());
            ServiceItem service = serviceId == null ? null : requireService(salon, serviceId);
            if (service != null) data.put("serviceId", service.id());

            LocalDate start = max(LocalDate.now(), SalonMcpSupport.parseDate(from, "the start date") == null
                    ? LocalDate.now() : SalonMcpSupport.parseDate(from, "the start date"));
            LocalDate end = min(start.plusDays(STYLIST_DAYS - 1L), salon.lastBookableDate());
            data.put("from", start.toString());
            if (!start.isAfter(end)) {
                var availability = bookings.queryAvailability(salon.id(), service == null ? null : service.id(),
                        stylist.id(), start, end, SalonAvailability.Granularity.DAY, null);
                data.put("days", SalonMcpSupport.dayMaps(availability));
                if (availability.firstAvailable() != null) {
                    data.put("firstAvailable", nullableMap(
                            "date", availability.firstAvailable().date().toString(),
                            "startTime", availability.firstAvailable().startTime().toString()));
                }
            } else {
                data.put("days", List.of());
            }
            LocalDate selectedDate = withinWindow(salon, SalonMcpSupport.parseDate(date, "the date"));
            if (service != null && selectedDate != null) {
                data.put("date", selectedDate.toString());
                data.put("slots", slotsFor(salon, service, stylist.id(), selectedDate));
            }
            return data;
        });
    }

    @McpTool(
            name = WEEK,
            title = "Book from the week view",
            description = "Open the week-view booking app: a Monday-to-Sunday grid of every open start time for a service (optionally for one stylist), with previous/next week navigation. The visitor taps a time, picks a stylist if several are free, and confirms. Pass serviceId, staffId and weekStart (yyyy-MM-dd, any day in the wanted week).",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, destructiveHint = false, openWorldHint = false),
            metaProvider = SalonMcpAppMeta.BookingWeekTool.class
    )
    McpSchema.CallToolResult bookingWeek(
            @McpToolParam(required = false, description = SalonMcpSupport.SALON_PARAM) String salonIdOrHandler,
            @McpToolParam(required = false, description = "Service id") Long serviceId,
            @McpToolParam(required = false, description = "Stylist id; omit for any stylist") Long staffId,
            @McpToolParam(required = false, description = "Any date inside the week to show, yyyy-MM-dd (defaults to this week)") String weekStart,
            McpTransportContext transport) {
        return support.run("Booking is temporarily unavailable. Please try again.", () -> {
            SalonRef salon = support.bookableSalon(salonIdOrHandler, transport);
            Map<String, Object> data = support.base(WEEK, "booking-week", salon);
            putChoices(data, salon);
            LocalDate requested = SalonMcpSupport.parseDate(weekStart, "the week");
            LocalDate monday = (requested == null ? LocalDate.now() : requested)
                    .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            LocalDate thisMonday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            if (monday.isBefore(thisMonday)) monday = thisMonday;
            LocalDate lastMonday = salon.lastBookableDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            if (monday.isAfter(lastMonday)) monday = lastMonday;
            data.put("weekStart", monday.toString());
            data.put("hasPreviousWeek", monday.isAfter(thisMonday));
            data.put("hasNextWeek", monday.isBefore(lastMonday));
            if (staffId != null) data.put("staffId", requireStaff(salon, staffId).id());
            if (serviceId == null) return data;

            ServiceItem service = requireService(salon, serviceId);
            data.put("serviceId", service.id());
            LocalDate today = LocalDate.now();
            LocalDate from = max(monday, today);
            LocalDate to = min(monday.plusDays(6), salon.lastBookableDate());
            Map<LocalDate, SalonAvailability.DayAvailability> byDate = new LinkedHashMap<>();
            if (!from.isAfter(to)) {
                bookings.queryAvailability(salon.id(), service.id(), staffId, from, to, SalonAvailability.Granularity.SLOT, null)
                        .days().forEach(d -> byDate.put(d.date(), d));
            }
            var days = new ArrayList<Map<String, Object>>();
            for (int i = 0; i < 7; i++) {
                LocalDate day = monday.plusDays(i);
                var availability = byDate.get(day);
                if (availability == null) {
                    days.add(nullableMap("date", day.toString(), "weekday", day.getDayOfWeek().name(),
                            "status", day.isBefore(today) ? "PAST" : "OUTSIDE_WINDOW",
                            "reason", day.isBefore(today) ? "This day has passed." : "Beyond the salon's booking window.",
                            "slots", List.of()));
                    continue;
                }
                var slots = availability.slots() == null ? List.<Map<String, Object>>of()
                        : SalonMcpSupport.groupedSlots(day, availability.slots());
                String status = availability.status() == SalonAvailability.DayStatus.OPEN && slots.isEmpty()
                        ? "FULLY_BOOKED" : availability.status().name();
                days.add(nullableMap("date", day.toString(), "weekday", availability.weekday().name(),
                        "status", status, "reason", "FULLY_BOOKED".equals(status) && availability.reason() == null
                                ? "No open times left that day." : availability.reason(),
                        "slots", slots));
            }
            data.put("days", days);
            return data;
        });
    }

    /** Services and bookable stylists — every booking app lets the visitor switch either. */
    private void putChoices(Map<String, Object> data, SalonRef salon) {
        data.put("services", activeServices(salon).stream().map(SalonMcpSupport::serviceMap).toList());
        data.put("staff", bookableStaff(salon).stream().map(m -> nullableMap(
                "id", m.id(), "name", m.name(), "role", m.role() == null ? "" : m.role().name(),
                "avatarUrl", SalonMcpSupport.value(m.avatarUrl()),
                "specializations", m.specializations().stream().map(StaffMember.Specialization::value).toList())).toList());
        data.put("bookingWindow", Map.of("from", LocalDate.now().toString(), "to", salon.lastBookableDate().toString()));
    }

    private List<Map<String, Object>> slotsFor(SalonRef salon, ServiceItem service, Long staffId, LocalDate date) {
        return SalonMcpSupport.groupedSlots(date, bookings.findAvailableSlots(salon.id(), service.id(), date, staffId));
    }

    private List<ServiceItem> activeServices(SalonRef salon) {
        return services.findAllBySalonId(salon.id()).stream().filter(ServiceItem::active).toList();
    }

    private List<StaffMember> bookableStaff(SalonRef salon) {
        return staff.findBySalonId(salon.id()).stream()
                .filter(m -> m.status() == StaffStatus.ACTIVE && m.availableForBooking()).toList();
    }

    private ServiceItem requireService(SalonRef salon, Long serviceId) {
        return services.findByIdAndSalonId(serviceId, salon.id())
                .filter(ServiceItem::active)
                .orElseThrow(() -> new IllegalArgumentException("Choose an active service at this salon."));
    }

    private StaffMember requireStaff(SalonRef salon, Long staffId) {
        return staff.findByIdAndSalonId(staffId, salon.id())
                .filter(m -> m.status() == StaffStatus.ACTIVE && m.availableForBooking())
                .orElseThrow(() -> new IllegalArgumentException("Choose a stylist who takes online bookings at this salon."));
    }

    private static LocalDate withinWindow(SalonRef salon, LocalDate date) {
        if (date == null) return null;
        LocalDate latest = salon.lastBookableDate();
        if (date.isBefore(LocalDate.now()) || date.isAfter(latest)) {
            throw new IllegalArgumentException("Choose a date from today through " + latest + ".");
        }
        return date;
    }

    private static YearMonth parseMonth(String month, LocalDate selectedDate) {
        if (month != null && !month.isBlank()) {
            try {
                return YearMonth.parse(month.strip());
            } catch (DateTimeParseException e) {
                throw new IllegalArgumentException("Enter the month using yyyy-MM.");
            }
        }
        return YearMonth.from(selectedDate == null ? LocalDate.now() : selectedDate);
    }

    private static LocalDate max(LocalDate a, LocalDate b) { return a.isAfter(b) ? a : b; }

    private static LocalDate min(LocalDate a, LocalDate b) { return a.isBefore(b) ? a : b; }
}
