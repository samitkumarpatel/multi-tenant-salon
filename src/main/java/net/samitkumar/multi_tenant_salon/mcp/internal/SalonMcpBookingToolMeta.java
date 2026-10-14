package net.samitkumar.multi_tenant_salon.mcp.internal;

import org.springframework.ai.mcp.annotation.context.MetaProvider;

import java.util.List;
import java.util.Map;

/** Booking creation is callable from the user-operated app, not directly by the model. */
public class SalonMcpBookingToolMeta implements MetaProvider {
    @Override
    public Map<String, Object> getMeta() {
        return Map.of("ui", Map.of(
                "resourceUri", SalonMcpAppToolMeta.RESOURCE_URI,
                "visibility", List.of("app")
        ));
    }
}
