package net.samitkumar.multi_tenant_salon.mcp.internal;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.spec.McpSchema;
import net.samitkumar.multi_tenant_salon.booking.AvailableSlot;
import net.samitkumar.multi_tenant_salon.booking.SalonAvailability;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.salon.SalonOpeningDay;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import net.samitkumar.multi_tenant_salon.staff.StaffMember;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Shared plumbing for every Salon MCP App tool: resolving the public salon, shaping the
 * service/staff/availability payloads the app UIs render, and wrapping them as tool results.
 */
@Component
class SalonMcpSupport {

    /** Description of every tool's salon argument — optional when connected through a salon's own URL. */
    static final String SALON_PARAM = "Salon public UUID or handler/slug. Omit it when connected through a salon's own MCP URL (/mcp/<salon-handle>) — that salon is used automatically.";

    /** A resolved, active salon — the starting point of every app tool call. */
    record SalonRef(UUID id, Salon salon) {
        boolean has(SalonFeature feature) {
            return salon.features().stream().anyMatch(f -> f.feature() == feature);
        }

        int advanceDays() {
            return Math.max(1, salon.bookingAdvanceDays() == null ? 60 : salon.bookingAdvanceDays());
        }

        LocalDate lastBookableDate() {
            return LocalDate.now().plusDays(advanceDays());
        }
    }

    private final SalonApi salons;
    private final ObjectMapper objectMapper;

    SalonMcpSupport(SalonApi salons, ObjectMapper objectMapper) {
        this.salons = salons;
        this.objectMapper = objectMapper;
    }

    /**
     * The salon a tool call is about. A salon-specific MCP URL ({@code /mcp/{salon}}) binds the
     * session to that salon and wins over any argument; on the shared {@code /mcp} endpoint the
     * caller must pass {@code salonIdOrHandler}.
     */
    SalonRef activeSalon(String salonIdOrHandler, McpTransportContext transport) {
        Object bound = transport == null ? null : transport.get(SalonMcpTransportConfiguration.SALON_CONTEXT_KEY);
        String key = bound != null ? bound.toString() : blankToNull(salonIdOrHandler);
        if (key == null) {
            throw new IllegalArgumentException("Which salon? Pass salonIdOrHandler (the salon's handle from its website), "
                    + "or connect with the salon's own MCP URL, which ends in /mcp/<salon-handle>.");
        }
        return activeSalon(key);
    }

    SalonRef bookableSalon(String salonIdOrHandler, McpTransportContext transport) {
        SalonRef salon = activeSalon(salonIdOrHandler, transport);
        if (!salon.has(SalonFeature.BOOKING)) {
            throw new IllegalArgumentException("Online booking is not available at this salon.");
        }
        return salon;
    }

    private SalonRef activeSalon(String salonIdOrHandler) {
        UUID salonId = salons.resolveId(salonIdOrHandler);
        Salon salon = salons.findById(salonId)
                .filter(s -> s.status() == Salon.SalonStatus.ACTIVE)
                .orElseThrow(() -> new IllegalArgumentException("Salon not found or unavailable."));
        return new SalonRef(salonId, salon);
    }

    /** The fields every app payload starts with, so each UI can render its header without guessing. */
    Map<String, Object> base(String app, String view, SalonRef salon) {
        return base(app, view, salon, openingCalendar(salon));
    }

    /** {@link #base(String, String, SalonRef)} for a caller that already loaded the opening calendar. */
    Map<String, Object> base(String app, String view, SalonRef salon, List<SalonOpeningDay> opening) {
        var data = new LinkedHashMap<String, Object>();
        data.put("app", app);
        data.put("view", view);
        data.put("salonId", salon.id().toString());
        data.put("salonName", salon.salon().name());
        data.put("bookingEnabled", salon.has(SalonFeature.BOOKING));
        data.put("shopEnabled", salon.has(SalonFeature.WEBSHOP));
        var contact = salon.salon().contact();
        if (contact != null) {
            var reach = nullableMap("phone", blankToNull(contact.phone()), "email", blankToNull(contact.email()));
            if (!reach.isEmpty()) data.put("contact", reach);
        }
        var today = SalonMcpOpening.today(opening, LocalTime.now());
        if (today != null) data.put("today", today);
        return data;
    }

    /** The salon's real opening from today, far enough ahead for the next opening and upcoming closures. */
    List<SalonOpeningDay> openingCalendar(SalonRef salon) {
        LocalDate today = LocalDate.now();
        var days = salons.openingCalendar(salon.id(), today, SalonMcpOpening.horizon(today));
        return days == null ? List.of() : days;
    }

    /** The salon's public address and maps link. */
    static Map<String, Object> location(SalonRef salon) {
        var l = salon.salon().location();
        return nullableMap(
                "address", l == null ? null : l.address(),
                "city", l == null ? null : l.city(),
                "state", l == null ? null : l.state(),
                "country", l == null ? null : l.country(),
                "zipCode", l == null ? null : l.zipCode(),
                "mapsUrl", l == null ? null : l.mapsUrl());
    }

    static Map<String, Object> serviceMap(ServiceItem s) {
        return nullableMap(
                "id", s.id(), "name", s.name(), "description", value(s.description()),
                "price", s.price(), "currency", value(s.currency()),
                "durationMinutes", s.durationMinutes() == null ? 0 : s.durationMinutes(),
                "category", s.category() == null ? "OTHER" : s.category().name(),
                "staffIds", s.assignedStaffIds().stream()
                        .map(ServiceItem.AssignedStaff::staffId)
                        .filter(id -> id != null && id.matches("\\d+"))
                        .map(Long::parseLong)
                        .toList());
    }

    static Map<String, Object> staffMap(StaffMember m) {
        return nullableMap(
                "id", m.id(), "name", m.name(), "role", m.role() == null ? "" : m.role().name(),
                "bio", value(m.bio()), "avatarUrl", value(m.avatarUrl()),
                "availableForBooking", m.availableForBooking(),
                "specializations", m.specializations().stream().map(StaffMember.Specialization::value).toList(),
                "workMedia", m.workMedia().stream().map(StaffMember.WorkMedia::value).toList());
    }

    /** A service is offered by a stylist when it is assigned to them, or assigned to nobody (anyone can do it). */
    static boolean offeredBy(ServiceItem service, Long staffId) {
        return service.assignedStaffIds().isEmpty() || service.assignedStaffIds().stream()
                .anyMatch(a -> String.valueOf(staffId).equals(a.staffId()));
    }

    /** Day statuses (no slots) — what a calendar or day strip greys out. */
    static List<Map<String, Object>> dayMaps(SalonAvailability availability) {
        return availability.days().stream().map(d -> nullableMap(
                "date", d.date().toString(),
                "weekday", d.weekday().name(),
                "status", d.status().name(),
                "reason", d.reason(),
                "openSlotCount", d.openSlotCount(),
                "firstOpenTime", d.firstOpenTime() == null ? null : d.firstOpenTime().toString(),
                "availableStaffIds", d.availableStaffIds())).toList();
    }

    /**
     * Open start times for one day, one entry per time with every stylist free then — the shape a
     * time grid wants (tap a time, optionally pick who). Times already past today are dropped.
     */
    static List<Map<String, Object>> groupedSlots(LocalDate date, List<AvailableSlot> slots) {
        LocalTime cutoff = date.equals(LocalDate.now()) ? LocalTime.now() : LocalTime.MIN;
        var byTime = new TreeMap<LocalTime, Map<String, Object>>();
        for (AvailableSlot slot : slots) {
            if (slot.booked() || slot.startTime().isBefore(cutoff)) continue;
            var entry = byTime.computeIfAbsent(slot.startTime(), t -> {
                var m = new LinkedHashMap<String, Object>();
                m.put("startTime", t.toString());
                m.put("endTime", slot.endTime().toString());
                m.put("staffIds", new java.util.ArrayList<Long>());
                return m;
            });
            @SuppressWarnings("unchecked")
            var staffIds = (List<Long>) entry.get("staffIds");
            if (slot.staffId() != null && !staffIds.contains(slot.staffId())) staffIds.add(slot.staffId());
        }
        return List.copyOf(byTime.values());
    }

    static LocalDate parseDate(String text, String label) {
        if (text == null || text.isBlank()) return null;
        try {
            return LocalDate.parse(text.strip());
        } catch (Exception e) {
            throw new IllegalArgumentException("Enter " + label + " using yyyy-MM-dd.");
        }
    }

    static Map<String, Object> nullableMap(Object... pairs) {
        var result = new LinkedHashMap<String, Object>();
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            if (pairs[i + 1] != null) result.put((String) pairs[i], pairs[i + 1]);
        }
        return result;
    }

    static String value(String value) { return value == null ? "" : value; }

    static String blankToNull(String value) { return value == null || value.isBlank() ? null : value.strip(); }

    /** Runs a tool body, turning validation and lookup failures into friendly {@code isError} results. */
    McpSchema.CallToolResult run(String unavailableMessage, Supplier<Map<String, Object>> body) {
        try {
            return result(body.get());
        } catch (IllegalArgumentException e) {
            return error(e.getMessage());
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return error(e.getReason() != null && !e.getReason().isBlank() ? e.getReason() : "Salon not found or unavailable.");
        } catch (Exception e) {
            return error(unavailableMessage);
        }
    }

    McpSchema.CallToolResult result(Map<String, Object> data) {
        try {
            return McpSchema.CallToolResult.builder()
                    .addTextContent(objectMapper.writeValueAsString(data))
                    .structuredContent(data)
                    .build();
        } catch (JsonProcessingException e) {
            return error("Could not prepare salon information.");
        }
    }

    static McpSchema.CallToolResult error(String message) {
        return McpSchema.CallToolResult.builder().addTextContent(message).isError(true).build();
    }
}
