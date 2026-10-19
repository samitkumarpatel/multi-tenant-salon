package net.samitkumar.multi_tenant_salon.mcp.internal;

import io.modelcontextprotocol.spec.McpSchema;
import net.samitkumar.multi_tenant_salon.mcp.SalonMcpChatGateway;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
class SalonMcpChatGatewayImpl implements SalonMcpChatGateway {
    private final SalonMcpTools explorer;
    private final SalonMcpCatalogAppTools catalog;
    private final SalonMcpBookingAppTools booking;
    private final SalonMcpShopAppTools shop;

    SalonMcpChatGatewayImpl(SalonMcpTools explorer, SalonMcpCatalogAppTools catalog,
                            SalonMcpBookingAppTools booking, SalonMcpShopAppTools shop) {
        this.explorer = explorer;
        this.catalog = catalog;
        this.booking = booking;
        this.shop = shop;
    }

    @Override
    public Map<String, Object> open(String tool, String salonId, Map<String, Object> args) {
        McpSchema.CallToolResult result = switch (tool) {
            case SalonMcpTools.EXPLORER -> explorer.exploreSalon(salonId, str(args, "view"),
                    num(args, "serviceId"), num(args, "staffId"), str(args, "date"), null);
            case SalonMcpCatalogAppTools.SERVICES -> catalog.exploreServices(salonId, str(args, "category"), num(args, "serviceId"), null);
            case SalonMcpCatalogAppTools.TEAM -> catalog.exploreTeam(salonId, num(args, "staffId"), str(args, "specialization"), null);
            case SalonMcpBookingAppTools.BOOKING -> booking.booking(salonId, num(args, "serviceId"), num(args, "staffId"),
                    str(args, "month"), str(args, "date"), null);
            case SalonMcpBookingAppTools.BY_STYLIST -> booking.bookingByStylist(salonId, num(args, "staffId"),
                    num(args, "serviceId"), str(args, "from"), str(args, "date"), null);
            case SalonMcpBookingAppTools.WEEK -> booking.bookingWeek(salonId, num(args, "serviceId"), num(args, "staffId"),
                    str(args, "weekStart"), null);
            case SalonMcpShopAppTools.SHOP -> shop.shop(salonId, num(args, "categoryId"), num(args, "brandId"),
                    num(args, "productId"), str(args, "query"), null);
            default -> SalonMcpSupport.error("Unknown salon app.");
        };
        if (result.structuredContent() instanceof Map<?, ?> structured) {
            Map<String, Object> data = new LinkedHashMap<>();
            structured.forEach((key, value) -> data.put(String.valueOf(key), value));
            return data;
        }
        String message = result.content().stream()
                .filter(McpSchema.TextContent.class::isInstance)
                .map(McpSchema.TextContent.class::cast)
                .map(McpSchema.TextContent::text)
                .findFirst().orElse("Salon information is temporarily unavailable.");
        return Map.of("app", tool, "view", "error", "salonId", salonId, "error", message);
    }

    private static String str(Map<String, Object> args, String key) {
        Object value = args.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private static Long num(Map<String, Object> args, String key) {
        Object value = args.get(key);
        if (value instanceof Number n) return n.longValue();
        if (value instanceof String s && s.matches("\\d+")) return Long.parseLong(s);
        return null;
    }
}
