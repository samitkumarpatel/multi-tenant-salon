package net.samitkumar.multi_tenant_salon.mcp.internal;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.spec.McpSchema;
import net.samitkumar.multi_tenant_salon.mcp.internal.SalonMcpSupport.SalonRef;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import org.springframework.ai.mcp.annotation.McpTool;
import org.springframework.ai.mcp.annotation.McpToolParam;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static net.samitkumar.multi_tenant_salon.mcp.internal.SalonMcpSupport.blankToNull;
import static net.samitkumar.multi_tenant_salon.mcp.internal.SalonMcpSupport.error;
import static net.samitkumar.multi_tenant_salon.mcp.internal.SalonMcpSupport.nullableMap;

/**
 * The salon membership MCP App: compare plans, then start a Stripe checkout via the app-only tool.
 * The membership becomes active (and the QR code is emailed) when Stripe confirms the payment.
 */
@Component
class SalonMcpMembershipAppTools {
    static final String MEMBERSHIP = "salon_membership";

    private final SalonMcpSupport support;
    private final SalonMcpMembershipClient client;
    private final ObjectMapper objectMapper;

    SalonMcpMembershipAppTools(SalonMcpSupport support, SalonMcpMembershipClient client, ObjectMapper objectMapper) {
        this.support = support;
        this.client = client;
        this.objectMapper = objectMapper;
    }

    @McpTool(
            name = MEMBERSHIP,
            title = "Salon membership",
            description = "Open the salon's interactive membership app: every plan on sale with its price and billing period, included services, discounts and perks, a side-by-side comparison, and joining online (the visitor pays by card in Stripe Checkout and then gets their membership QR code by email). Pass planId to open on one plan. The visitor joins themselves inside the app.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, destructiveHint = false, openWorldHint = false),
            metaProvider = SalonMcpAppMeta.MembershipTool.class
    )
    McpSchema.CallToolResult membership(
            @McpToolParam(required = false, description = SalonMcpSupport.SALON_PARAM) String salonIdOrHandler,
            @McpToolParam(required = false, description = "Membership plan id to open") Long planId,
            McpTransportContext transport) {
        return support.run("Memberships are temporarily unavailable. Please try again.", () -> {
            SalonRef salon = membershipSalon(salonIdOrHandler, transport);
            JsonNode catalog = read(client.plans(salon.id().toString()));
            Map<String, Object> data = support.base(MEMBERSHIP, "plans", salon);
            data.put("plans", plans(catalog.path("plans")));
            data.put("onlineSignup", catalog.path("onlineSignup").asBoolean(false));
            if (planId != null) data.put("planId", planId);
            return data;
        });
    }

    @McpTool(
            name = "create_membership_checkout",
            title = "Start membership checkout",
            description = "Start the Stripe checkout for a membership after the visitor reviews the plan and taps Continue to payment in the Salon membership app. This tool is only available to the embedded app UI, not to the assistant. It requires customerConfirmed=true. Returns the checkout URL the app opens; nothing is charged until the visitor pays there.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = false, destructiveHint = false, idempotentHint = false, openWorldHint = true),
            metaProvider = SalonMcpAppMeta.CreateMembershipCheckoutTool.class
    )
    McpSchema.CallToolResult createMembershipCheckout(
            @McpToolParam(required = false, description = SalonMcpSupport.SALON_PARAM) String salonIdOrHandler,
            @McpToolParam(description = "Membership plan id") Long planId,
            @McpToolParam(description = "Visitor's name") String customerName,
            @McpToolParam(description = "Visitor's email address — the QR code is sent here") String customerEmail,
            @McpToolParam(required = false, description = "Visitor's phone number") String customerPhone,
            @McpToolParam(description = "Must be true only after the visitor taps Continue to payment in the review view") Boolean customerConfirmed,
            McpTransportContext transport) {
        try {
            if (!Boolean.TRUE.equals(customerConfirmed)) {
                throw new IllegalArgumentException("The visitor must review the plan and confirm first.");
            }
            if (planId == null) throw new IllegalArgumentException("Choose a plan.");
            if (customerName == null || customerName.isBlank() || customerEmail == null || customerEmail.isBlank()) {
                throw new IllegalArgumentException("Enter a name and an email address.");
            }
            SalonRef salon = membershipSalon(salonIdOrHandler, transport);
            // No return URL: Stripe sends the visitor back to the salon website's Membership page.
            JsonNode body = read(client.checkout(salon.id().toString(), new SalonMcpMembershipClient.CheckoutRequest(
                    planId, customerName.strip(), customerEmail.strip(), blankToNull(customerPhone), null)));
            var checkout = nullableMap(
                    "subscriptionId", body.path("subscriptionId").isNumber() ? body.path("subscriptionId").asLong() : null,
                    "checkoutUrl", text(body, "checkoutUrl"),
                    "salonName", salon.salon().name(),
                    "customerEmail", customerEmail.strip());
            return support.result(Map.of("app", MEMBERSHIP, "view", "checkout", "checkout", checkout));
        } catch (IllegalArgumentException e) {
            return error(e.getMessage());
        } catch (RestClientResponseException e) {
            return error(reason(e, "We couldn't start the checkout. Please try again."));
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return error("Salon not found or unavailable.");
        } catch (Exception e) {
            return error("We couldn't start the checkout right now. Please try again.");
        }
    }

    private SalonRef membershipSalon(String salonIdOrHandler, McpTransportContext transport) {
        SalonRef salon = support.activeSalon(salonIdOrHandler, transport);
        if (!salon.has(SalonFeature.MEMBERSHIP)) {
            throw new IllegalArgumentException("This salon doesn't offer memberships.");
        }
        return salon;
    }

    /** The API's own message (e.g. "This plan is full") when it sent one the visitor can act on. */
    private String reason(RestClientResponseException e, String fallback) {
        try {
            JsonNode body = objectMapper.readTree(e.getResponseBodyAsString());
            for (var field : List.of("detail", "message", "error")) {
                String value = text(body, field);
                if (value != null && e.getStatusCode().is4xxClientError()) return value;
            }
        } catch (Exception ignored) {
            // Not JSON — fall back.
        }
        return fallback;
    }

    private JsonNode read(String json) {
        try {
            return objectMapper.readTree(json == null ? "{}" : json);
        } catch (Exception e) {
            throw new IllegalStateException("Unreadable membership response", e);
        }
    }

    private static List<Map<String, Object>> plans(JsonNode array) {
        var result = new ArrayList<Map<String, Object>>();
        array.forEach(p -> {
            var perks = new ArrayList<String>();
            p.path("perks").forEach(perk -> { if (perk.isTextual() && !perk.asText().isBlank()) perks.add(perk.asText()); });
            var included = new ArrayList<Map<String, Object>>();
            p.path("includedServices").forEach(s -> included.add(nullableMap(
                    "serviceId", s.path("serviceId").asLong(),
                    "name", s.path("name").asText(""),
                    "durationMinutes", s.path("durationMinutes").isNumber() ? s.path("durationMinutes").asInt() : null,
                    "price", decimal(s, "price"),
                    "quantityPerCycle", s.path("quantityPerCycle").asInt(1))));
            result.add(nullableMap(
                    "id", p.path("id").asLong(),
                    "name", p.path("name").asText(""),
                    "description", text(p, "description"),
                    "price", decimal(p, "price"),
                    "currency", text(p, "currency"),
                    "billingInterval", text(p, "billingInterval"),
                    "signupFee", decimal(p, "signupFee"),
                    "serviceDiscountPercent", p.path("serviceDiscountPercent").isNumber() ? p.path("serviceDiscountPercent").asInt() : null,
                    "productDiscountPercent", p.path("productDiscountPercent").isNumber() ? p.path("productDiscountPercent").asInt() : null,
                    "spotsLeft", p.path("spotsLeft").isNumber() ? p.path("spotsLeft").asInt() : null,
                    "soldOut", p.path("soldOut").asBoolean(false),
                    "highlighted", p.path("highlighted").asBoolean(false),
                    "includedValue", decimal(p, "includedValue"),
                    "perks", perks,
                    "includedServices", included));
        });
        return result;
    }

    private static java.math.BigDecimal decimal(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.decimalValue() : null;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() || value.asText().isBlank() ? null : value.asText();
    }
}
