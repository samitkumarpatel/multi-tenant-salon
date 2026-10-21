package net.samitkumar.multi_tenant_salon.mcp.internal;

import org.springframework.ai.mcp.annotation.context.MetaProvider;

import java.util.List;
import java.util.Map;

/**
 * MCP Apps {@code _meta.ui} for every salon app. Each model-visible tool links to its own UI
 * resource ({@code ui://salon/<app>.html}, built from {@code frontend/apps/salon-mcp-app}); the
 * write tools are {@code visibility: ["app"]} so only a visitor's tap in an app can call them.
 * The nested classes exist because {@code metaProvider} takes a no-arg class, not an instance.
 */
public final class SalonMcpAppMeta {
    public static final String EXPLORER_URI = "ui://salon/explorer.html";
    public static final String SERVICES_URI = "ui://salon/services.html";
    public static final String TEAM_URI = "ui://salon/team.html";
    public static final String BOOKING_URI = "ui://salon/booking.html";
    public static final String BOOKING_STYLIST_URI = "ui://salon/booking-stylist.html";
    public static final String BOOKING_WEEK_URI = "ui://salon/booking-week.html";
    public static final String SHOP_URI = "ui://salon/shop.html";
    public static final String MEMBERSHIP_URI = "ui://salon/membership.html";

    private SalonMcpAppMeta() {}

    // "openai/outputTemplate" is ChatGPT's alias for ui.resourceUri — newer ChatGPT reads the
    // standard key, older builds only render the view when the alias is present.
    private static Map<String, Object> tool(String uri) {
        return Map.of("ui", Map.of("resourceUri", uri), "openai/outputTemplate", uri);
    }

    // "openai/widgetAccessible" is ChatGPT's equivalent of letting the view (not the model) call
    // the tool; the standard visibility: ["app"] already hides it from the model elsewhere.
    private static Map<String, Object> appOnlyTool(String uri) {
        return Map.of("ui", Map.of("resourceUri", uri, "visibility", List.of("app")),
                "openai/outputTemplate", uri, "openai/widgetAccessible", true);
    }

    public static class ExplorerTool implements MetaProvider {
        @Override public Map<String, Object> getMeta() { return tool(EXPLORER_URI); }
    }

    public static class ServicesTool implements MetaProvider {
        @Override public Map<String, Object> getMeta() { return tool(SERVICES_URI); }
    }

    public static class TeamTool implements MetaProvider {
        @Override public Map<String, Object> getMeta() { return tool(TEAM_URI); }
    }

    public static class BookingTool implements MetaProvider {
        @Override public Map<String, Object> getMeta() { return tool(BOOKING_URI); }
    }

    public static class BookingStylistTool implements MetaProvider {
        @Override public Map<String, Object> getMeta() { return tool(BOOKING_STYLIST_URI); }
    }

    public static class BookingWeekTool implements MetaProvider {
        @Override public Map<String, Object> getMeta() { return tool(BOOKING_WEEK_URI); }
    }

    public static class ShopTool implements MetaProvider {
        @Override public Map<String, Object> getMeta() { return tool(SHOP_URI); }
    }

    public static class MembershipTool implements MetaProvider {
        @Override public Map<String, Object> getMeta() { return tool(MEMBERSHIP_URI); }
    }

    /** create_customer_booking — callable from any booking-capable app, never by the model. */
    public static class CreateBookingTool implements MetaProvider {
        @Override public Map<String, Object> getMeta() { return appOnlyTool(BOOKING_URI); }
    }

    /** salon_next_available — "next free" hints for the booking and guide apps, never called by the model. */
    public static class NextAvailableTool implements MetaProvider {
        @Override public Map<String, Object> getMeta() { return appOnlyTool(BOOKING_URI); }
    }

    /** create_shop_order — callable from the shop app only, never by the model. */
    public static class CreateOrderTool implements MetaProvider {
        @Override public Map<String, Object> getMeta() { return appOnlyTool(SHOP_URI); }
    }

    /** create_membership_checkout — callable from the membership app only, never by the model. */
    public static class CreateMembershipCheckoutTool implements MetaProvider {
        @Override public Map<String, Object> getMeta() { return appOnlyTool(MEMBERSHIP_URI); }
    }
}
