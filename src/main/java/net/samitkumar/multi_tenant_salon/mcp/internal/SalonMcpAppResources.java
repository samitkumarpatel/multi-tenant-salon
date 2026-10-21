package net.samitkumar.multi_tenant_salon.mcp.internal;

import io.modelcontextprotocol.spec.McpSchema;
import org.springframework.ai.mcp.annotation.McpResource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

/**
 * The single-file HTML views behind each Salon MCP App. They are built by
 * {@code frontend/apps/salon-mcp-app} into {@code static/mcp-app/<app>.html}, which the
 * salon website also iframes directly.
 *
 * <p>Each read carries the view's Content Security Policy in {@code _meta.ui.csp}. Hosts such as
 * Claude block every external origin not listed there, so {@code resourceDomains} names where
 * stylist photos, portfolio media and product images are served from: the media CDN for S3/Azure
 * storage or the backend itself for LOCAL storage, plus any extra origins configured
 * under {@code spring.application.mcp.app-resource-domains}. The views never fetch over the
 * network themselves — all data goes through the host's tool bridge — so {@code connectDomains}
 * stays empty.
 */
@Component
class SalonMcpAppResources {
    private static final String APP_MIME_TYPE = "text/html;profile=mcp-app";

    private final Map<String, Object> contentMeta;

    SalonMcpAppResources(
            @Value("${spring.application.media.storage-type:LOCAL}") String storageType,
            @Value("${spring.application.media.staff-cdn-base-url:https://staff.salonsaas.org}") String cdnBaseUrl,
            @Value("${spring.application.media.local-base-url:http://localhost:8080}") String localBaseUrl,
            @Value("${spring.application.mcp.app-resource-domains:}") String extraDomains) {
        List<String> resourceDomains = resourceDomains(storageType, cdnBaseUrl, localBaseUrl, extraDomains);
        this.contentMeta = Map.of(
                "ui", Map.of("csp", Map.of("resourceDomains", resourceDomains, "connectDomains", List.of())),
                // ChatGPT's equivalent of ui.csp.
                "openai/widgetCSP", Map.of("resource_domains", resourceDomains, "connect_domains", List.of()));
    }

    /** Origins (scheme://host[:port]) the views may load images and videos from. */
    static List<String> resourceDomains(String storageType, String cdnBaseUrl, String localBaseUrl, String extraDomains) {
        // Uploads land on the CDN for S3/Azure storage and on the backend itself for LOCAL storage.
        String uploads = "LOCAL".equalsIgnoreCase(storageType) ? localBaseUrl : cdnBaseUrl;
        var origins = new LinkedHashSet<String>();
        Stream.concat(Stream.of(uploads), Arrays.stream(extraDomains == null ? new String[0] : extraDomains.split(",")))
                .map(SalonMcpAppResources::origin)
                .filter(o -> o != null)
                .forEach(origins::add);
        return List.copyOf(origins);
    }

    private static String origin(String url) {
        if (url == null || url.isBlank()) return null;
        try {
            URI uri = URI.create(url.strip());
            if (uri.getScheme() == null || uri.getHost() == null) return null;
            return uri.getScheme() + "://" + uri.getHost() + (uri.getPort() == -1 ? "" : ":" + uri.getPort());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    @McpResource(uri = SalonMcpAppMeta.EXPLORER_URI, name = "Salon Explorer UI", title = "Salon info",
            description = "Salon overview, opening hours, location and contact details.",
            mimeType = APP_MIME_TYPE)
    McpSchema.ReadResourceResult explorer() { return html(SalonMcpAppMeta.EXPLORER_URI, "explorer"); }

    @McpResource(uri = SalonMcpAppMeta.SERVICES_URI, name = "Salon Services UI", title = "Explore services",
            description = "Searchable, categorised service menu with prices, durations and in-app booking.",
            mimeType = APP_MIME_TYPE)
    McpSchema.ReadResourceResult services() { return html(SalonMcpAppMeta.SERVICES_URI, "services"); }

    @McpResource(uri = SalonMcpAppMeta.TEAM_URI, name = "Salon Team UI", title = "Explore the team",
            description = "Stylist profiles with bios, specialisations, portfolio media and booking.",
            mimeType = APP_MIME_TYPE)
    McpSchema.ReadResourceResult team() { return html(SalonMcpAppMeta.TEAM_URI, "team"); }

    @McpResource(uri = SalonMcpAppMeta.BOOKING_URI, name = "Salon Booking UI", title = "Book an appointment",
            description = "Step-by-step booking: service, stylist, calendar date, time, details and confirmation.",
            mimeType = APP_MIME_TYPE)
    McpSchema.ReadResourceResult booking() { return html(SalonMcpAppMeta.BOOKING_URI, "booking"); }

    @McpResource(uri = SalonMcpAppMeta.BOOKING_STYLIST_URI, name = "Salon Booking by Stylist UI", title = "Book by stylist",
            description = "Pick a stylist first, then see the days they work and their open times.",
            mimeType = APP_MIME_TYPE)
    McpSchema.ReadResourceResult bookingByStylist() { return html(SalonMcpAppMeta.BOOKING_STYLIST_URI, "booking-stylist"); }

    @McpResource(uri = SalonMcpAppMeta.BOOKING_WEEK_URI, name = "Salon Booking Week UI", title = "Book from the week view",
            description = "A seven-day grid of open times for a service, week by week.",
            mimeType = APP_MIME_TYPE)
    McpSchema.ReadResourceResult bookingWeek() { return html(SalonMcpAppMeta.BOOKING_WEEK_URI, "booking-week"); }

    @McpResource(uri = SalonMcpAppMeta.SHOP_URI, name = "Salon Shop UI", title = "Salon shop",
            description = "Browse the salon's products, choose variants, build a cart and check out.",
            mimeType = APP_MIME_TYPE)
    McpSchema.ReadResourceResult shop() { return html(SalonMcpAppMeta.SHOP_URI, "shop"); }

    @McpResource(uri = SalonMcpAppMeta.MEMBERSHIP_URI, name = "Salon Membership UI", title = "Salon membership",
            description = "Compare the salon's membership plans and join online with card payment.",
            mimeType = APP_MIME_TYPE)
    McpSchema.ReadResourceResult membership() { return html(SalonMcpAppMeta.MEMBERSHIP_URI, "membership"); }

    private McpSchema.ReadResourceResult html(String uri, String app) {
        String text;
        try {
            text = new ClassPathResource("static/mcp-app/" + app + ".html").getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("Salon MCP App resource '" + app + "' is missing. Build frontend/apps/salon-mcp-app first.", e);
        }
        return new McpSchema.ReadResourceResult(List.of(new McpSchema.TextResourceContents(uri, APP_MIME_TYPE, text, contentMeta)));
    }
}
