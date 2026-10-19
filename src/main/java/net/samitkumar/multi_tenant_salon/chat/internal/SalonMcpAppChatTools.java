package net.samitkumar.multi_tenant_salon.chat.internal;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import net.samitkumar.multi_tenant_salon.mcp.SalonMcpChatGateway;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.BiConsumer;

/**
 * Per-turn assistant tools that route the website chat through the shared Salon MCP Apps — one
 * tool per app, mirroring the MCP server's model-visible tools. The last app opened in a turn is
 * the one the website embeds under the reply.
 */
class SalonMcpAppChatTools {
    /** The app renders the full data; the model only needs enough of it to introduce the app. */
    static final int MAX_RESULT_CHARS = 8_000;

    private final String salonId;
    private final SalonMcpChatGateway gateway;
    private final ObjectMapper mapper;
    /** Told the moment an app is opened — the streaming reply forwards it before the text finishes. */
    private final BiConsumer<String, Map<String, Object>> onAppOpened;
    // Written on Reactor's tool-execution thread when streaming, read when the reply is assembled.
    private volatile String appTool;
    private volatile Map<String, Object> appCall;
    private volatile Map<String, Object> appResult;

    SalonMcpAppChatTools(String salonId, SalonMcpChatGateway gateway, ObjectMapper mapper) {
        this(salonId, gateway, mapper, (tool, call) -> { });
    }

    SalonMcpAppChatTools(String salonId, SalonMcpChatGateway gateway, ObjectMapper mapper,
                         BiConsumer<String, Map<String, Object>> onAppOpened) {
        this.salonId = salonId;
        this.gateway = gateway;
        this.mapper = mapper;
        this.onAppOpened = onAppOpened;
    }

    @Tool(name = "salon_explorer", description = "Open the Salon info app: overview, opening hours, location and contact details. Use for 'where are you', 'when are you open', 'how do I contact you'.")
    String salonExplorer(
            @ToolParam(description = "One of overview, hours, location") String view) {
        return open("salon_explorer", "view", view == null || view.isBlank() ? "overview" : view);
    }

    @Tool(name = "salon_services", description = "Open the Explore services app: the full service menu by category with prices, durations, who performs each, search, and a Book button. Use for 'what do you offer', prices, 'how long does X take'.")
    String salonServices(
            @ToolParam(required = false, description = "Category to open on: HAIR, MAKEUP, NAILS, SKIN_CARE, BEARD, MASSAGE, WAXING, OTHER") String category,
            @ToolParam(required = false, description = "Service id to highlight") Long serviceId) {
        return open("salon_services", "category", category, "serviceId", serviceId);
    }

    @Tool(name = "salon_team", description = "Open the Explore team app: stylists with photos, roles, specialisations, bios, portfolio and their services, with booking. Use for 'who works there', 'tell me about <stylist>', 'show me their work'. Pass staffId to open one stylist's profile.")
    String salonTeam(
            @ToolParam(required = false, description = "Staff id whose profile to open") Long staffId,
            @ToolParam(required = false, description = "Specialisation to filter by") String specialization) {
        return open("salon_team", "staffId", staffId, "specialization", specialization);
    }

    @Tool(name = "salon_booking", description = "Open the step-by-step Booking app (service → stylist → month calendar → time → details → confirm). The default for 'I want to book' or a booking on a specific day. Pass what you already know: serviceId, staffId, date (yyyy-MM-dd) or month (yyyy-MM).")
    String salonBooking(
            @ToolParam(required = false, description = "Service id") Long serviceId,
            @ToolParam(required = false, description = "Stylist id") Long staffId,
            @ToolParam(required = false, description = "Month to show, yyyy-MM") String month,
            @ToolParam(required = false, description = "Date to show times for, yyyy-MM-dd") String date) {
        return open("salon_booking", "serviceId", serviceId, "staffId", staffId, "month", month, "date", date);
    }

    @Tool(name = "salon_booking_by_stylist", description = "Open the Book by stylist app: pick a stylist, see the days they work over the next two weeks and their open times. Use when the visitor wants a particular stylist or asks 'when is <stylist> free'.")
    String salonBookingByStylist(
            @ToolParam(required = false, description = "Stylist id") Long staffId,
            @ToolParam(required = false, description = "Service id") Long serviceId,
            @ToolParam(required = false, description = "Date to show times for, yyyy-MM-dd") String date) {
        return open("salon_booking_by_stylist", "staffId", staffId, "serviceId", serviceId, "date", date);
    }

    @Tool(name = "salon_booking_week", description = "Open the Week view booking app: a Monday-Sunday grid of every open time for a service. Use for 'what's free this/next week', 'show me the week', comparing several days.")
    String salonBookingWeek(
            @ToolParam(required = false, description = "Service id") Long serviceId,
            @ToolParam(required = false, description = "Stylist id") Long staffId,
            @ToolParam(required = false, description = "Any date in the week to show, yyyy-MM-dd") String weekStart) {
        return open("salon_booking_week", "serviceId", serviceId, "staffId", staffId, "weekStart", weekStart);
    }

    @Tool(name = "salon_shop", description = "Open the Shop app: the salon's products with photos, variants, stock, a cart and checkout. Use for products, retail, 'do you sell X', buying something.")
    String salonShop(
            @ToolParam(required = false, description = "Search text, e.g. shampoo") String query,
            @ToolParam(required = false, description = "Product id to open") Long productId) {
        return open("salon_shop", "query", query, "productId", productId);
    }

    private String open(String tool, Object... pairs) {
        Map<String, Object> arguments = new LinkedHashMap<>();
        for (int i = 0; i + 1 < pairs.length; i += 2) {
            Object value = pairs[i + 1];
            if (value != null && !(value instanceof String s && s.isBlank())) arguments.put((String) pairs[i], value);
        }
        Map<String, Object> call = new LinkedHashMap<>();
        call.put("salonIdOrHandler", salonId);
        call.putAll(arguments);
        appTool = tool;
        appCall = Map.copyOf(call);
        onAppOpened.accept(tool, appCall);
        try {
            appResult = gateway.open(tool, salonId, arguments);
            return truncate(mapper.writeValueAsString(appResult));
        } catch (JsonProcessingException e) {
            return "Salon information is temporarily unavailable.";
        }
    }

    static String truncate(String json) {
        return json.length() <= MAX_RESULT_CHARS ? json
                : json.substring(0, MAX_RESULT_CHARS) + "… (truncated; the app shows everything)";
    }

    String appTool() { return appTool; }
    Map<String, Object> appCall() { return appCall; }
    Map<String, Object> appResult() { return appResult; }
}
