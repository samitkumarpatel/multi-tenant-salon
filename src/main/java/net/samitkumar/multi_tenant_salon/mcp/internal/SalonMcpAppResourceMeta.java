package net.samitkumar.multi_tenant_salon.mcp.internal;

import org.springframework.ai.mcp.annotation.context.MetaProvider;

import java.util.Map;

/** Restricts the MCP App view to its bundled assets and host-provided tool bridge. */
public class SalonMcpAppResourceMeta implements MetaProvider {
    @Override
    public Map<String, Object> getMeta() {
        return Map.of("ui", Map.of("csp", Map.of(
                "resourceDomains", new String[0],
                "connectDomains", new String[0]
        )));
    }
}
