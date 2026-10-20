package net.samitkumar.multi_tenant_salon.mcp.internal;

import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.spec.McpSchema;
import net.samitkumar.multi_tenant_salon.mcp.internal.SalonMcpSupport.SalonRef;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import net.samitkumar.multi_tenant_salon.staff.StaffApi;
import net.samitkumar.multi_tenant_salon.staff.StaffMember;
import net.samitkumar.multi_tenant_salon.staff.StaffStatus;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** "Explore services" and "Explore the team" MCP Apps. */
@Component
class SalonMcpCatalogAppTools {
    static final String SERVICES = "salon_services";
    static final String TEAM = "salon_team";

    private final SalonMcpSupport support;
    private final SalonServiceApi services;
    private final StaffApi staff;

    SalonMcpCatalogAppTools(SalonMcpSupport support, SalonServiceApi services, StaffApi staff) {
        this.support = support;
        this.services = services;
        this.staff = staff;
    }

    @McpTool(
            name = SERVICES,
            title = "Explore services",
            description = "Open the salon's interactive service menu: services grouped by category with prices, durations, descriptions and who performs them, plus search and category filters. Each service opens as its own detail card with the stylists who perform it (tap through to their profiles) and a Book button; booking happens right inside the app when online booking is enabled. Pass category to open on one category (HAIR, MAKEUP, NAILS, SKIN_CARE, BEARD, MASSAGE, WAXING, OTHER) or serviceId to open straight on that service's detail card.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, destructiveHint = false, openWorldHint = false),
            metaProvider = SalonMcpAppMeta.ServicesTool.class
    )
    McpSchema.CallToolResult exploreServices(
            @McpToolParam(required = false, description = SalonMcpSupport.SALON_PARAM) String salonIdOrHandler,
            @McpToolParam(required = false, description = "Category to open on, e.g. HAIR or NAILS") String category,
            @McpToolParam(required = false, description = "Service id whose detail card to open") Long serviceId,
            McpTransportContext transport) {
        return support.run("Services are temporarily unavailable. Please try again.", () -> {
            SalonRef salon = support.activeSalon(salonIdOrHandler, transport);
            List<ServiceItem> active = services.findAllBySalonId(salon.id()).stream().filter(ServiceItem::active).toList();
            Map<String, Object> data = support.base(SERVICES, "services", salon);
            data.put("items", active.stream().map(SalonMcpSupport::serviceMap).toList());
            data.put("categories", categoryCounts(active));
            data.put("staff", bookableStaff(salon).stream().map(SalonMcpCatalogAppTools::staffChip).toList());
            if (category != null && !category.isBlank()) data.put("category", category.strip().toUpperCase());
            if (serviceId != null) data.put("serviceId", serviceId);
            return data;
        });
    }

    @McpTool(
            name = TEAM,
            title = "Explore the team",
            description = "Open the salon's interactive team app: every active stylist with role, specialisations and a specialisation filter. Each stylist opens as their own profile page with bio, portfolio photos/videos and the services they perform (tap through to each service's details) and a Book button when they take online bookings. Pass staffId to open straight on one stylist's profile page.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, destructiveHint = false, openWorldHint = false),
            metaProvider = SalonMcpAppMeta.TeamTool.class
    )
    McpSchema.CallToolResult exploreTeam(
            @McpToolParam(required = false, description = SalonMcpSupport.SALON_PARAM) String salonIdOrHandler,
            @McpToolParam(required = false, description = "Staff member id whose profile page to open") Long staffId,
            @McpToolParam(required = false, description = "Specialisation to filter by, e.g. Balayage") String specialization,
            McpTransportContext transport) {
        return support.run("The team is temporarily unavailable. Please try again.", () -> {
            SalonRef salon = support.activeSalon(salonIdOrHandler, transport);
            List<StaffMember> members = staff.findBySalonId(salon.id()).stream()
                    .filter(m -> m.status() == StaffStatus.ACTIVE).toList();
            List<ServiceItem> active = services.findAllBySalonId(salon.id()).stream().filter(ServiceItem::active).toList();
            Map<String, Object> data = support.base(TEAM, "team", salon);
            data.put("items", members.stream().map(m -> {
                var member = new LinkedHashMap<>(SalonMcpSupport.staffMap(m));
                member.put("serviceIds", active.stream()
                        .filter(s -> !s.assignedStaffIds().isEmpty() && SalonMcpSupport.offeredBy(s, m.id()))
                        .map(ServiceItem::id).toList());
                return member;
            }).toList());
            data.put("services", active.stream().map(SalonMcpSupport::serviceMap).toList());
            data.put("specializations", members.stream()
                    .flatMap(m -> m.specializations().stream().map(StaffMember.Specialization::value))
                    .filter(s -> s != null && !s.isBlank())
                    .distinct().sorted(String.CASE_INSENSITIVE_ORDER).toList());
            if (staffId != null) data.put("staffId", staffId);
            if (specialization != null && !specialization.isBlank()) data.put("specialization", specialization.strip());
            return data;
        });
    }

    private List<StaffMember> bookableStaff(SalonRef salon) {
        return staff.findBySalonId(salon.id()).stream().filter(m -> m.status() == StaffStatus.ACTIVE).toList();
    }

    static Map<String, Object> staffChip(StaffMember m) {
        return SalonMcpSupport.nullableMap("id", m.id(), "name", m.name(),
                "role", m.role() == null ? "" : m.role().name(),
                "avatarUrl", SalonMcpSupport.value(m.avatarUrl()),
                "availableForBooking", m.availableForBooking());
    }

    private static List<Map<String, Object>> categoryCounts(List<ServiceItem> active) {
        return active.stream()
                .collect(Collectors.groupingBy(s -> s.category() == null ? "OTHER" : s.category().name(),
                        LinkedHashMap::new, Collectors.counting()))
                .entrySet().stream()
                .map(e -> Map.<String, Object>of("id", e.getKey(), "count", e.getValue()))
                .toList();
    }
}
