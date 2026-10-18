package net.samitkumar.multi_tenant_salon.chat.internal;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.samitkumar.multi_tenant_salon.mcp.SalonMcpChatGateway;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

import java.util.LinkedHashMap;
import java.util.Map;

/** Per-turn assistant tools that route the website chat through the shared Salon MCP App tool. */
class SalonMcpAppChatTools {
    private final String salonId;
    private final SalonMcpChatGateway gateway;
    private final ObjectMapper mapper;
    private Map<String, Object> appCall;
    private Map<String, Object> appResult;

    SalonMcpAppChatTools(String salonId, SalonMcpChatGateway gateway, ObjectMapper mapper) {
        this.salonId = salonId;
        this.gateway = gateway;
        this.mapper = mapper;
    }

    @Tool(name = "salon_explorer", description = "Open the interactive salon app for a visitor's question. Choose one view: overview, services, team, hours, location, or availability. Pass serviceId/staffId/date only when needed for availability. The app lets the visitor navigate and book.")
    String salonExplorer(
            @ToolParam(description = "One of overview, services, team, hours, location, availability") String view,
            @ToolParam(required = false, description = "Service id for availability") Long serviceId,
            @ToolParam(required = false, description = "Staff id for availability") Long staffId,
            @ToolParam(required = false, description = "Date for availability, yyyy-MM-dd") String date) {
        Map<String, Object> arguments = new LinkedHashMap<>();
        arguments.put("salonIdOrHandler", salonId);
        arguments.put("view", view == null || view.isBlank() ? "overview" : view);
        if (serviceId != null) arguments.put("serviceId", serviceId);
        if (staffId != null) arguments.put("staffId", staffId);
        if (date != null && !date.isBlank()) arguments.put("date", date);
        appCall = Map.copyOf(arguments);
        try {
            appResult = gateway.explore(salonId, view, serviceId, staffId, date);
            return mapper.writeValueAsString(appResult);
        } catch (JsonProcessingException e) {
            return "Salon information is temporarily unavailable.";
        }
    }

    Map<String, Object> appCall() { return appCall; }
    Map<String, Object> appResult() { return appResult; }
}
