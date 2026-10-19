package net.samitkumar.multi_tenant_salon.mcp.internal;

import org.springframework.ai.mcp.annotation.McpResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * The single-file HTML views behind each Salon MCP App. They are built by
 * {@code frontend/apps/salon-mcp-app} into {@code static/mcp-app/<app>.html}, which the
 * salon website also iframes directly.
 */
@Component
class SalonMcpAppResources {
    private static final String APP_MIME_TYPE = "text/html;profile=mcp-app";

    @McpResource(uri = SalonMcpAppMeta.EXPLORER_URI, name = "Salon Explorer UI", title = "Salon info",
            description = "Salon overview, opening hours, location and contact details.",
            mimeType = APP_MIME_TYPE, metaProvider = SalonMcpAppMeta.Resource.class)
    String explorer() { return html("explorer"); }

    @McpResource(uri = SalonMcpAppMeta.SERVICES_URI, name = "Salon Services UI", title = "Explore services",
            description = "Searchable, categorised service menu with prices, durations and in-app booking.",
            mimeType = APP_MIME_TYPE, metaProvider = SalonMcpAppMeta.Resource.class)
    String services() { return html("services"); }

    @McpResource(uri = SalonMcpAppMeta.TEAM_URI, name = "Salon Team UI", title = "Explore the team",
            description = "Stylist profiles with bios, specialisations, portfolio media and booking.",
            mimeType = APP_MIME_TYPE, metaProvider = SalonMcpAppMeta.Resource.class)
    String team() { return html("team"); }

    @McpResource(uri = SalonMcpAppMeta.BOOKING_URI, name = "Salon Booking UI", title = "Book an appointment",
            description = "Step-by-step booking: service, stylist, calendar date, time, details and confirmation.",
            mimeType = APP_MIME_TYPE, metaProvider = SalonMcpAppMeta.Resource.class)
    String booking() { return html("booking"); }

    @McpResource(uri = SalonMcpAppMeta.BOOKING_STYLIST_URI, name = "Salon Booking by Stylist UI", title = "Book by stylist",
            description = "Pick a stylist first, then see the days they work and their open times.",
            mimeType = APP_MIME_TYPE, metaProvider = SalonMcpAppMeta.Resource.class)
    String bookingByStylist() { return html("booking-stylist"); }

    @McpResource(uri = SalonMcpAppMeta.BOOKING_WEEK_URI, name = "Salon Booking Week UI", title = "Book from the week view",
            description = "A seven-day grid of open times for a service, week by week.",
            mimeType = APP_MIME_TYPE, metaProvider = SalonMcpAppMeta.Resource.class)
    String bookingWeek() { return html("booking-week"); }

    @McpResource(uri = SalonMcpAppMeta.SHOP_URI, name = "Salon Shop UI", title = "Salon shop",
            description = "Browse the salon's products, choose variants, build a cart and check out.",
            mimeType = APP_MIME_TYPE, metaProvider = SalonMcpAppMeta.Resource.class)
    String shop() { return html("shop"); }

    private static String html(String app) {
        try {
            return new ClassPathResource("static/mcp-app/" + app + ".html").getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Salon MCP App resource '" + app + "' is missing. Build frontend/apps/salon-mcp-app first.", e);
        }
    }
}
