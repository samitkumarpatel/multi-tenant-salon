package net.samitkumar.multi_tenant_salon.mcp.internal;

import io.modelcontextprotocol.spec.McpSchema;
import net.samitkumar.multi_tenant_salon.mcp.SalonMcpChatGateway;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
class SalonMcpChatGatewayImpl implements SalonMcpChatGateway {
    private final SalonMcpTools tools;

    SalonMcpChatGatewayImpl(SalonMcpTools tools) {
        this.tools = tools;
    }

    @Override
    public Map<String, Object> explore(String salonId, String view, Long serviceId, Long staffId, String date) {
        McpSchema.CallToolResult result = tools.exploreSalon(salonId, view, serviceId, staffId, date);
        if (result.structuredContent() instanceof Map<?, ?> structured) {
            Map<String, Object> data = new java.util.LinkedHashMap<>();
            structured.forEach((key, value) -> data.put(String.valueOf(key), value));
            return data;
        }
        String message = result.content().stream()
                .filter(McpSchema.TextContent.class::isInstance)
                .map(McpSchema.TextContent.class::cast)
                .map(McpSchema.TextContent::text)
                .findFirst().orElse("Salon information is temporarily unavailable.");
        return Map.of("view", "error", "salonId", salonId, "error", message);
    }
}
