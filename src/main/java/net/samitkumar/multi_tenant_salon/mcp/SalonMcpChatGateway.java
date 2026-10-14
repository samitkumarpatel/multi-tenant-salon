package net.samitkumar.multi_tenant_salon.mcp;

import java.util.Map;

/** Calls the same salon MCP tool that external MCP Apps hosts use. */
public interface SalonMcpChatGateway {
    Map<String, Object> explore(String salonId, String view, Long serviceId, Long staffId, String date);
}
