package net.samitkumar.multi_tenant_salon.mcp.internal;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.spec.McpSchema;
import net.samitkumar.multi_tenant_salon.booking.BookingApi;
import net.samitkumar.multi_tenant_salon.mcp.internal.SalonMcpSupport.SalonRef;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonOpeningDay;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import net.samitkumar.multi_tenant_salon.staff.StaffApi;
import net.samitkumar.multi_tenant_salon.staff.StaffMember;
import net.samitkumar.multi_tenant_salon.staff.StaffStatus;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientResponseException;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import static net.samitkumar.multi_tenant_salon.mcp.internal.SalonMcpSupport.blankToNull;
import static net.samitkumar.multi_tenant_salon.mcp.internal.SalonMcpSupport.error;
import static net.samitkumar.multi_tenant_salon.mcp.internal.SalonMcpSupport.nullableMap;

/**
 * The general "Salon info" app ({@code salon_explorer}) plus the app-only booking write that every
 * booking-capable app funnels through. The explorer keeps its services/team/availability views
 * for MCP clients that still call them; the dedicated apps are the richer path.
 */
@Component
class SalonMcpTools {
    static final String EXPLORER = "salon_explorer";

    private final SalonMcpSupport support;
    private final SalonApi salons;
    private final SalonServiceApi services;
    private final StaffApi staff;
    private final BookingApi bookings;
    private final SalonMcpBookingClient bookingClient;
    private final ObjectMapper objectMapper;

    SalonMcpTools(SalonMcpSupport support, SalonApi salons, SalonServiceApi services, StaffApi staff,
                  BookingApi bookings, SalonMcpBookingClient bookingClient, ObjectMapper objectMapper) {
        this.support = support;
        this.salons = salons;
        this.services = services;
        this.staff = staff;
        this.bookings = bookings;
        this.bookingClient = bookingClient;
        this.objectMapper = objectMapper;
    }

    @McpTool(
            name = EXPLORER,
            title = "Salon info",
            description = "Show a salon's live overview, opening hours, location and contact details in an interactive view. Opening hours are real dates: today's open/closed status with the next opening, the coming week with holidays and closures applied, and upcoming holidays. The view links on to the service menu, the team, stylist profiles and booking inside the same app. The salonIdOrHandler is the salon's public UUID or handler/slug. Prefer the dedicated apps for services (salon_services), the team (salon_team), booking (salon_booking, salon_booking_by_stylist, salon_booking_week) and the shop (salon_shop). This tool never creates or changes a booking.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, destructiveHint = false, openWorldHint = false),
            metaProvider = SalonMcpAppMeta.ExplorerTool.class
    )
    McpSchema.CallToolResult exploreSalon(
            @McpToolParam(required = false, description = SalonMcpSupport.SALON_PARAM) String salonIdOrHandler,
            @McpToolParam(required = false, description = "One of overview, hours (dated week, holidays and closures), location; defaults to overview (services, team and availability are kept for older clients)") String view,
            @McpToolParam(required = false, description = "Service id when checking availability") Long serviceId,
            @McpToolParam(required = false, description = "Staff member id when narrowing availability") Long staffId,
            @McpToolParam(required = false, description = "Availability date in yyyy-MM-dd format") String date,
            McpTransportContext transport) {
        return support.run("Salon information is temporarily unavailable. Please try again.", () -> {
            SalonRef salon = support.activeSalon(salonIdOrHandler, transport);
            String selected = view == null || view.isBlank() ? "overview" : view.toLowerCase();
            var opening = support.openingCalendar(salon);
            Map<String, Object> data = support.base(EXPLORER, selected, salon, opening);
            switch (selected) {
                case "overview" -> {
                    data.put("salon", salonProfile(salon));
                    data.put("location", SalonMcpSupport.location(salon));
                    putHours(data, salon, opening);
                }
                case "services" -> data.put("items", services.findAllBySalonId(salon.id()).stream()
                        .filter(ServiceItem::active).map(SalonMcpSupport::serviceMap).toList());
                case "team" -> data.put("items", staff.findBySalonId(salon.id()).stream()
                        .filter(m -> m.status() == StaffStatus.ACTIVE).map(SalonMcpSupport::staffMap).toList());
                case "hours" -> putHours(data, salon, opening);
                case "location" -> data.put("location", SalonMcpSupport.location(salon));
                case "availability" -> availability(salon, data, serviceId, staffId, date);
                default -> throw new IllegalArgumentException("Choose overview, hours, or location.");
            }
            return data;
        });
    }

    @McpTool(
            name = "create_customer_booking",
            title = "Confirm salon booking",
            description = "Create a customer booking after the visitor reviews and explicitly confirms the booking in a Salon booking app. This tool is only available to the embedded app UI, not to the assistant. It requires customerConfirmed=true and a currently available slot.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = false, destructiveHint = false, idempotentHint = false, openWorldHint = false),
            metaProvider = SalonMcpAppMeta.CreateBookingTool.class
    )
    McpSchema.CallToolResult createCustomerBooking(
            @McpToolParam(required = false, description = SalonMcpSupport.SALON_PARAM) String salonIdOrHandler,
            @McpToolParam(description = "Active service id selected by the visitor") Long serviceId,
            @McpToolParam(description = "Booking date in yyyy-MM-dd format") String date,
            @McpToolParam(description = "Selected start time in HH:mm format") String startTime,
            @McpToolParam(required = false, description = "Staff member id returned with the selected available slot") Long staffId,
            @McpToolParam(description = "Visitor's name") String customerName,
            @McpToolParam(required = false, description = "Visitor's email address") String customerEmail,
            @McpToolParam(required = false, description = "Visitor's phone number") String customerPhone,
            @McpToolParam(required = false, description = "Optional booking notes") String notes,
            @McpToolParam(description = "Must be true only after the visitor taps Confirm booking in the review view") Boolean customerConfirmed,
            McpTransportContext transport) {
        try {
            if (!Boolean.TRUE.equals(customerConfirmed)) {
                throw new IllegalArgumentException("The visitor must review and confirm the booking first.");
            }
            if (customerName == null || customerName.isBlank()) {
                throw new IllegalArgumentException("Enter the visitor's name.");
            }
            if ((customerEmail == null || customerEmail.isBlank()) && (customerPhone == null || customerPhone.isBlank())) {
                throw new IllegalArgumentException("Enter an email address or phone number.");
            }
            SalonRef salon = support.bookableSalon(salonIdOrHandler, transport);
            LocalDate bookingDate = SalonMcpSupport.parseDate(date, "the date");
            if (bookingDate == null) throw new IllegalArgumentException("Choose a date.");
            LocalTime bookingTime = LocalTime.parse(startTime);
            ServiceItem service = services.findByIdAndSalonId(serviceId, salon.id())
                    .filter(ServiceItem::active)
                    .orElseThrow(() -> new IllegalArgumentException("Choose an active service at this salon."));
            boolean slotIsAvailable = bookings.findAvailableSlots(salon.id(), service.id(), bookingDate, staffId).stream()
                    .anyMatch(slot -> !slot.booked() && slot.startTime().equals(bookingTime)
                            && (staffId == null || staffId.equals(slot.staffId())));
            if (!slotIsAvailable) {
                throw new IllegalArgumentException("That time is no longer available. Check availability and choose another time.");
            }

            var response = bookingClient.createBooking(salon.id().toString(), new SalonMcpBookingClient.CreateBookingRequest(
                    service.id(), staffId, customerName.strip(), blankToNull(customerEmail), blankToNull(customerPhone),
                    bookingDate.toString(), bookingTime.toString(), blankToNull(notes), null));
            var body = objectMapper.readTree(response);
            var booking = body.has("booking") ? body.path("booking") : body;
            Long bookedStaffId = booking.path("staffId").isMissingNode() || booking.path("staffId").isNull()
                    ? staffId : Long.valueOf(booking.path("staffId").asLong());
            var confirmation = nullableMap(
                    "status", booking.path("status").asText(null),
                    "bookingId", booking.path("id").isMissingNode() ? null : booking.path("id").asLong(),
                    "salonName", salon.salon().name(),
                    "serviceName", service.name(),
                    "date", bookingDate.toString(),
                    "startTime", bookingTime.toString(),
                    "endTime", booking.path("endTime").isMissingNode() || booking.path("endTime").isNull()
                            ? bookingTime.plusMinutes(service.durationMinutes() == null ? 60 : service.durationMinutes()).toString()
                            : booking.path("endTime").asText().substring(0, 5),
                    // Where and how to reach the salon — the confirmation's directions, call and calendar entry.
                    "location", SalonMcpSupport.location(salon),
                    "salonPhone", salon.salon().contact() == null ? null : blankToNull(salon.salon().contact().phone()),
                    "staffId", bookedStaffId,
                    "staffName", bookedStaffId == null ? null
                            : staff.findByIdAndSalonId(bookedStaffId, salon.id()).map(StaffMember::name).orElse(null),
                    "paymentStatus", booking.path("paymentStatus").asText(null),
                    "checkoutUrl", body.path("checkoutUrl").asText(null),
                    "message", body.has("checkoutUrl") ? "Booking created. Complete payment to finish." : "Booking request submitted.");
            return support.result(Map.of("view", "booking-confirmation", "booking", confirmation));
        } catch (IllegalArgumentException e) {
            return error(e.getMessage());
        } catch (java.time.format.DateTimeParseException e) {
            return error("Choose a start time in HH:mm format.");
        } catch (RestClientResponseException e) {
            return error("We couldn't create that booking. The selected time may have just been taken; please check availability and try again.");
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return error("Salon not found or unavailable.");
        } catch (Exception e) {
            return error("We couldn't create that booking right now. Please try again.");
        }
    }

    /** Weekly template ({@code items}) plus the real dated week and the upcoming holidays/closures. */
    private void putHours(Map<String, Object> data, SalonRef salon, List<SalonOpeningDay> opening) {
        data.put("items", salons.findOperatingHours(salon.id()));
        data.put("week", SalonMcpOpening.week(opening, 7));
        data.put("upcomingClosures", SalonMcpOpening.upcomingClosures(
                opening.stream().limit(SalonMcpOpening.UPCOMING_CLOSURE_DAYS).toList()));
    }

    private static Map<String, Object> salonProfile(SalonRef salon) {
        var s = salon.salon();
        return nullableMap(
                "name", s.name(),
                "handler", s.handler(),
                "location", SalonMcpSupport.location(salon),
                "contact", nullableMap(
                        "phone", s.contact() == null ? null : s.contact().phone(),
                        "email", s.contact() == null ? null : s.contact().email(),
                        "website", s.contact() == null ? null : s.contact().website()),
                "bookingEnabled", salon.has(net.samitkumar.multi_tenant_salon.salon.SalonFeature.BOOKING),
                "bookingAdvanceDays", salon.advanceDays());
    }

    private void availability(SalonRef salon, Map<String, Object> data, Long serviceId, Long staffId, String dateText) {
        if (!salon.has(net.samitkumar.multi_tenant_salon.salon.SalonFeature.BOOKING)) {
            throw new IllegalArgumentException("Online booking is not available at this salon.");
        }
        List<Map<String, Object>> serviceChoices = services.findAllBySalonId(salon.id()).stream()
                .filter(ServiceItem::active)
                .map(s -> Map.<String, Object>of("id", s.id(), "name", s.name(), "durationMinutes", s.durationMinutes() == null ? 0 : s.durationMinutes()))
                .toList();
        data.put("services", serviceChoices);
        LocalDate date = SalonMcpSupport.parseDate(dateText, "a date");
        if (serviceId == null || date == null) {
            data.put("date", "");
            data.put("items", List.of());
            return;
        }
        var service = services.findByIdAndSalonId(serviceId, salon.id())
                .filter(ServiceItem::active)
                .orElseThrow(() -> new IllegalArgumentException("Choose an active service at this salon."));
        if (staffId != null && staff.findByIdAndSalonId(staffId, salon.id()).filter(m -> m.status() == StaffStatus.ACTIVE).isEmpty()) {
            throw new IllegalArgumentException("Choose an active team member at this salon.");
        }
        LocalDate latest = salon.lastBookableDate();
        if (date.isBefore(LocalDate.now()) || date.isAfter(latest)) {
            throw new IllegalArgumentException("Choose a date from today through " + latest + ".");
        }
        data.put("serviceId", service.id());
        data.put("serviceName", service.name());
        data.put("date", date.toString());
        data.put("items", bookings.findAvailableSlots(salon.id(), service.id(), date, staffId).stream()
                .filter(slot -> !slot.booked())
                .map(slot -> nullableMap("staffId", slot.staffId(), "startTime", slot.startTime().toString(), "endTime", slot.endTime().toString()))
                .toList());
    }
}
