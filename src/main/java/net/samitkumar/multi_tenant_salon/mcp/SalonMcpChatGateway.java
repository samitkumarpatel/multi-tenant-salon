package net.samitkumar.multi_tenant_salon.mcp;

import java.util.Map;
import java.util.Set;

/** Calls the same salon MCP App tools that external MCP Apps hosts use. */
public interface SalonMcpChatGateway {
    /** Model-visible app tools the website chat may open. */
    Set<String> APP_TOOLS = Set.of("salon_explorer", "salon_services", "salon_team", "salon_booking",
            "salon_booking_by_stylist", "salon_booking_week", "salon_shop");

    /**
     * Runs one app tool for {@code salonId} with the given tool arguments (without
     * {@code salonIdOrHandler}). Returns the tool's structured result, or {@code view=error}
     * with a visitor-friendly {@code error} message.
     */
    Map<String, Object> open(String tool, String salonId, Map<String, Object> arguments);
}
