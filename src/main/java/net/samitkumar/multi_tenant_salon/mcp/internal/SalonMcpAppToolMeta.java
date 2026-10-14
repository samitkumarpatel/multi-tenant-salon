package net.samitkumar.multi_tenant_salon.mcp.internal;

import org.springframework.ai.mcp.annotation.context.MetaProvider;

import java.util.Map;

/** Connects salon_explorer to the MCP Apps UI resource. */
public class SalonMcpAppToolMeta implements MetaProvider {
    public static final String RESOURCE_URI = "ui://salon/explorer.html";

    @Override
    public Map<String, Object> getMeta() {
        return Map.of("ui", Map.of("resourceUri", RESOURCE_URI));
    }
}
