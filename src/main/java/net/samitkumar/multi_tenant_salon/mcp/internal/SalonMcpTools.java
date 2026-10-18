package net.samitkumar.multi_tenant_salon.mcp.internal;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.spec.McpSchema;
import net.samitkumar.multi_tenant_salon.booking.AvailableSlot;
import net.samitkumar.multi_tenant_salon.booking.BookingApi;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import net.samitkumar.multi_tenant_salon.staff.StaffApi;
import net.samitkumar.multi_tenant_salon.staff.StaffMember;
import net.samitkumar.multi_tenant_salon.staff.StaffStatus;
import org.springframework.ai.mcp.annotation.McpResource;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.client.RestClientResponseException;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
class SalonMcpTools {
    private static final String APP_MIME_TYPE = "text/html;profile=mcp-app";

    private final SalonApi salons;
    private final SalonServiceApi services;
    private final StaffApi staff;
    private final BookingApi bookings;
    private final SalonMcpBookingClient bookingClient;
    private final ObjectMapper objectMapper;

    SalonMcpTools(SalonApi salons, SalonServiceApi services, StaffApi staff,
                  BookingApi bookings, SalonMcpBookingClient bookingClient, ObjectMapper objectMapper) {
        this.salons = salons;
        this.services = services;
        this.staff = staff;
        this.bookings = bookings;
        this.bookingClient = bookingClient;
        this.objectMapper = objectMapper;
    }

    @McpTool(
            name = "salon_explorer",
            title = "Explore a salon",
            description = "Show a salon's live profile, services, team, opening hours, location, or real booking availability in an interactive view. The salonIdOrHandler is the salon's public UUID or handler/slug. Use this tool when a visitor asks to browse salon information or availability. This tool never creates or changes a booking.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, destructiveHint = false, openWorldHint = false),
            metaProvider = SalonMcpAppToolMeta.class
    )
    McpSchema.CallToolResult exploreSalon(
            @McpToolParam(description = "Salon public UUID or handler/slug") String salonIdOrHandler,
            @McpToolParam(description = "One of overview, services, team, hours, location, availability") String view,
            @McpToolParam(required = false, description = "Service id when checking availability") Long serviceId,
            @McpToolParam(required = false, description = "Staff member id when narrowing availability") Long staffId,
            @McpToolParam(required = false, description = "Availability date in yyyy-MM-dd format") String date) {
        try {
            UUID salonId = salons.resolveId(salonIdOrHandler);
            Salon salon = salons.findById(salonId)
                    .filter(s -> s.status() == Salon.SalonStatus.ACTIVE)
                    .orElseThrow(() -> new IllegalArgumentException("Salon not found or unavailable."));
            Map<String, Object> data = switch (view == null ? "overview" : view.toLowerCase()) {
                case "overview" -> overview(salonId, salon);
                case "services" -> services(salonId, salon);
                case "team" -> team(salonId, salon);
                case "hours" -> hours(salonId, salon);
                case "location" -> location(salonId, salon);
                case "availability" -> availability(salonId, salon, serviceId, staffId, date);
                default -> throw new IllegalArgumentException("Choose overview, services, team, hours, location, or availability.");
            };
            return result(data);
        } catch (IllegalArgumentException e) {
            return error(e.getMessage());
        } catch (ResponseStatusException e) {
            return error("Salon not found or unavailable.");
        } catch (Exception e) {
            return error("Salon information is temporarily unavailable. Please try again.");
        }
    }

    @McpResource(
            uri = SalonMcpAppToolMeta.RESOURCE_URI,
            name = "Salon Explorer UI",
            title = "Interactive salon explorer",
            description = "Interactive salon details, services, team, opening hours, location, and live availability.",
            mimeType = APP_MIME_TYPE,
            metaProvider = SalonMcpAppResourceMeta.class
    )
    String salonExplorerResource() {
        try {
            return new ClassPathResource("static/mcp-app/index.html").getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Salon MCP App resource is missing. Build frontend/apps/salon-mcp-app first.", e);
        }
    }

    @McpTool(
            name = "create_customer_booking",
            title = "Confirm salon booking",
            description = "Create a customer booking after the visitor reviews and explicitly confirms the booking in the Salon Explorer app. This tool is only available to the embedded app UI, not to the assistant. It requires customerConfirmed=true and a currently available slot.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = false, destructiveHint = false, idempotentHint = false, openWorldHint = false),
            metaProvider = SalonMcpBookingToolMeta.class
    )
    McpSchema.CallToolResult createCustomerBooking(
            @McpToolParam(description = "Salon public UUID or handler/slug") String salonIdOrHandler,
            @McpToolParam(description = "Active service id selected by the visitor") Long serviceId,
            @McpToolParam(description = "Booking date in yyyy-MM-dd format") String date,
            @McpToolParam(description = "Selected start time in HH:mm format") String startTime,
            @McpToolParam(required = false, description = "Staff member id returned with the selected available slot") Long staffId,
            @McpToolParam(description = "Visitor's name") String customerName,
            @McpToolParam(required = false, description = "Visitor's email address") String customerEmail,
            @McpToolParam(required = false, description = "Visitor's phone number") String customerPhone,
            @McpToolParam(required = false, description = "Optional booking notes") String notes,
            @McpToolParam(description = "Must be true only after the visitor taps Confirm booking in the review view") Boolean customerConfirmed) {
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
            UUID salonId = salons.resolveId(salonIdOrHandler);
            Salon salon = salons.findById(salonId)
                    .filter(s -> s.status() == Salon.SalonStatus.ACTIVE)
                    .orElseThrow(() -> new IllegalArgumentException("Salon not found or unavailable."));
            if (!hasFeature(salon, SalonFeature.BOOKING)) {
                throw new IllegalArgumentException("Online booking is not available at this salon.");
            }
            LocalDate bookingDate = LocalDate.parse(date);
            java.time.LocalTime bookingTime = java.time.LocalTime.parse(startTime);
            ServiceItem service = services.findByIdAndSalonId(serviceId, salonId)
                    .filter(ServiceItem::active)
                    .orElseThrow(() -> new IllegalArgumentException("Choose an active service at this salon."));
            boolean slotIsAvailable = bookings.findAvailableSlots(salonId, service.id(), bookingDate, staffId).stream()
                    .anyMatch(slot -> !slot.booked() && slot.startTime().equals(bookingTime)
                            && (staffId == null || staffId.equals(slot.staffId())));
            if (!slotIsAvailable) {
                throw new IllegalArgumentException("That time is no longer available. Check availability and choose another time.");
            }

            var response = bookingClient.createBooking(salonId.toString(), new SalonMcpBookingClient.CreateBookingRequest(
                    service.id(), staffId, customerName.strip(), blankToNull(customerEmail), blankToNull(customerPhone),
                    bookingDate.toString(), bookingTime.toString(), blankToNull(notes), null));
            var body = objectMapper.readTree(response);
            var booking = body.has("booking") ? body.path("booking") : body;
            var confirmation = nullableMap(
                    "status", booking.path("status").asText(null),
                    "bookingId", booking.path("id").isMissingNode() ? null : booking.path("id").asLong(),
                    "salonName", salon.name(),
                    "serviceName", service.name(),
                    "date", bookingDate.toString(),
                    "startTime", bookingTime.toString(),
                    "staffId", booking.path("staffId").isMissingNode() ? staffId : booking.path("staffId").asLong(),
                    "paymentStatus", booking.path("paymentStatus").asText(null),
                    "checkoutUrl", body.path("checkoutUrl").asText(null),
                    "message", body.has("checkoutUrl") ? "Booking created. Complete payment to finish." : "Booking request submitted.");
            return result(Map.of("view", "booking-confirmation", "booking", confirmation));
        } catch (IllegalArgumentException e) {
            return error(e.getMessage());
        } catch (RestClientResponseException e) {
            return error("We couldn't create that booking. The selected time may have just been taken; please check availability and try again.");
        } catch (ResponseStatusException e) {
            return error("Salon not found or unavailable.");
        } catch (Exception e) {
            return error("We couldn't create that booking right now. Please try again.");
        }
    }

    private Map<String, Object> overview(UUID salonId, Salon salon) {
        return Map.of(
                "view", "overview",
                "salonId", salonId.toString(),
                "bookingEnabled", hasFeature(salon, SalonFeature.BOOKING),
                "salon", Map.of(
                        "name", salon.name(),
                        "handler", salon.handler(),
                        "location", nullableMap(
                                "address", salon.location() == null ? null : salon.location().address(),
                                "city", salon.location() == null ? null : salon.location().city(),
                                "state", salon.location() == null ? null : salon.location().state(),
                                "country", salon.location() == null ? null : salon.location().country(),
                                "zipCode", salon.location() == null ? null : salon.location().zipCode(),
                                "mapsUrl", salon.location() == null ? null : salon.location().mapsUrl()),
                        "contact", nullableMap(
                                "phone", salon.contact() == null ? null : salon.contact().phone(),
                                "email", salon.contact() == null ? null : salon.contact().email(),
                                "website", salon.contact() == null ? null : salon.contact().website()),
                        "bookingEnabled", hasFeature(salon, SalonFeature.BOOKING),
                        "bookingAdvanceDays", salon.bookingAdvanceDays()
                ),
                "items", salons.findOperatingHours(salonId)
        );
    }

    private Map<String, Object> services(UUID salonId, Salon salon) {
        List<Map<String, Object>> items = services.findAllBySalonId(salonId).stream()
                .filter(ServiceItem::active)
                .map(s -> nullableMap(
                        "id", s.id(), "name", s.name(), "description", value(s.description()),
                        "price", s.price(), "currency", value(s.currency()),
                        "durationMinutes", s.durationMinutes() == null ? 0 : s.durationMinutes(),
                        "category", s.category() == null ? "" : s.category().name()))
                .toList();
        return Map.of("view", "services", "salonId", salonId.toString(), "salonName", salon.name(),
                "bookingEnabled", hasFeature(salon, SalonFeature.BOOKING), "items", items);
    }

    private Map<String, Object> team(UUID salonId, Salon salon) {
        List<Map<String, Object>> items = staff.findBySalonId(salonId).stream()
                .filter(m -> m.status() == StaffStatus.ACTIVE)
                .map(m -> Map.<String, Object>of(
                        "id", m.id(), "name", m.name(), "role", m.role().name(), "bio", value(m.bio()),
                        "avatarUrl", value(m.avatarUrl()), "availableForBooking", m.availableForBooking(),
                        "specializations", m.specializations().stream().map(StaffMember.Specialization::value).toList(),
                        "workMedia", m.workMedia().stream().map(StaffMember.WorkMedia::value).toList()))
                .toList();
        return Map.of("view", "team", "salonId", salonId.toString(), "salonName", salon.name(),
                "bookingEnabled", hasFeature(salon, SalonFeature.BOOKING), "items", items);
    }

    private Map<String, Object> hours(UUID salonId, Salon salon) {
        return Map.of("view", "hours", "salonId", salonId.toString(), "salonName", salon.name(),
                "bookingEnabled", hasFeature(salon, SalonFeature.BOOKING),
                "items", salons.findOperatingHours(salonId));
    }

    private Map<String, Object> location(UUID salonId, Salon salon) {
        return Map.of("view", "location", "salonId", salonId.toString(), "salonName", salon.name(),
                "bookingEnabled", hasFeature(salon, SalonFeature.BOOKING),
                "location", nullableMap(
                        "address", salon.location() == null ? null : salon.location().address(),
                        "city", salon.location() == null ? null : salon.location().city(),
                        "state", salon.location() == null ? null : salon.location().state(),
                        "country", salon.location() == null ? null : salon.location().country(),
                        "zipCode", salon.location() == null ? null : salon.location().zipCode(),
                        "mapsUrl", salon.location() == null ? null : salon.location().mapsUrl()));
    }

    private Map<String, Object> availability(UUID salonId, Salon salon, Long serviceId, Long staffId, String dateText) {
        if (!hasFeature(salon, SalonFeature.BOOKING)) {
            throw new IllegalArgumentException("Online booking is not available at this salon.");
        }
        List<Map<String, Object>> serviceChoices = services.findAllBySalonId(salonId).stream()
                .filter(ServiceItem::active)
                .map(s -> Map.<String, Object>of("id", s.id(), "name", s.name(), "durationMinutes", s.durationMinutes() == null ? 0 : s.durationMinutes()))
                .toList();
        if (serviceId == null || dateText == null || dateText.isBlank()) {
            return Map.of("view", "availability", "salonId", salonId.toString(), "salonName", salon.name(),
                    "bookingEnabled", true,
                    "services", serviceChoices, "date", "", "items", List.of());
        }
        LocalDate date;
        try {
            date = LocalDate.parse(dateText);
        } catch (Exception e) {
            throw new IllegalArgumentException("Enter a date using yyyy-MM-dd.");
        }
        var service = services.findByIdAndSalonId(serviceId, salonId)
                .filter(ServiceItem::active)
                .orElseThrow(() -> new IllegalArgumentException("Choose an active service at this salon."));
        if (staffId != null && staff.findByIdAndSalonId(staffId, salonId).filter(m -> m.status() == StaffStatus.ACTIVE).isEmpty()) {
            throw new IllegalArgumentException("Choose an active team member at this salon.");
        }
        LocalDate today = LocalDate.now();
        LocalDate latest = today.plusDays(Math.max(1, salon.bookingAdvanceDays()));
        if (date.isBefore(today) || date.isAfter(latest)) {
            throw new IllegalArgumentException("Choose a date from today through " + latest + ".");
        }
        List<Map<String, Object>> items = bookings.findAvailableSlots(salonId, service.id(), date, staffId).stream()
                .filter(slot -> !slot.booked())
                .map(slot -> slotMap(slot))
                .toList();
        return Map.of("view", "availability", "salonId", salonId.toString(), "salonName", salon.name(),
                "bookingEnabled", true,
                "serviceId", service.id(), "serviceName", service.name(), "date", date.toString(),
                "services", serviceChoices, "items", items);
    }

    private static Map<String, Object> slotMap(AvailableSlot slot) {
        return nullableMap("staffId", slot.staffId(), "startTime", slot.startTime().toString(), "endTime", slot.endTime().toString());
    }

    private static Map<String, Object> nullableMap(Object... pairs) {
        var result = new java.util.LinkedHashMap<String, Object>();
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            if (pairs[i + 1] != null) result.put((String) pairs[i], pairs[i + 1]);
        }
        return result;
    }

    private static String value(String value) { return value == null ? "" : value; }
    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.strip(); }

    private static boolean hasFeature(Salon salon, SalonFeature feature) {
        return salon.features().stream().anyMatch(f -> f.feature() == feature);
    }

    private McpSchema.CallToolResult result(Map<String, Object> data) {
        try {
            return McpSchema.CallToolResult.builder()
                    .addTextContent(objectMapper.writeValueAsString(data))
                    .structuredContent(data)
                    .build();
        } catch (JsonProcessingException e) {
            return error("Could not prepare salon information.");
        }
    }

    private static McpSchema.CallToolResult error(String message) {
        return McpSchema.CallToolResult.builder().addTextContent(message).isError(true).build();
    }
}
