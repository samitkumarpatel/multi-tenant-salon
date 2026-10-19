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

/** The salon shop MCP App: browse the storefront, then check out via the app-only order tool. */
@Component
class SalonMcpShopAppTools {
    static final String SHOP = "salon_shop";

    /** The app's quantity picker never offers more than this, whatever is on the shelf. */
    private static final int MAX_QUANTITY = 10;

    /** One cart line sent by the shop app at checkout. */
    record OrderItem(Long variantId, Integer quantity) {}

    private final SalonMcpSupport support;
    private final SalonMcpShopClient shopClient;
    private final ObjectMapper objectMapper;

    SalonMcpShopAppTools(SalonMcpSupport support, SalonMcpShopClient shopClient, ObjectMapper objectMapper) {
        this.support = support;
        this.shopClient = shopClient;
        this.objectMapper = objectMapper;
    }

    @McpTool(
            name = SHOP,
            title = "Salon shop",
            description = "Open the salon's interactive shop: products with photos, brands and categories, variant choice (size/colour), stock, a cart and checkout. Pass categoryId or brandId to open filtered, query to pre-fill the search, or productId to open one product. The visitor places the order themselves inside the app.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = true, destructiveHint = false, openWorldHint = false),
            metaProvider = SalonMcpAppMeta.ShopTool.class
    )
    McpSchema.CallToolResult shop(
            @McpToolParam(required = false, description = SalonMcpSupport.SALON_PARAM) String salonIdOrHandler,
            @McpToolParam(required = false, description = "Category id to filter by") Long categoryId,
            @McpToolParam(required = false, description = "Brand id to filter by") Long brandId,
            @McpToolParam(required = false, description = "Product id to open") Long productId,
            @McpToolParam(required = false, description = "Search text, e.g. shampoo") String query,
            McpTransportContext transport) {
        return support.run("The shop is temporarily unavailable. Please try again.", () -> {
            SalonRef salon = shopSalon(salonIdOrHandler, transport);
            String id = salon.id().toString();
            Map<String, Object> data = support.base(SHOP, "shop", salon);
            data.put("categories", named(read(shopClient.categories(id))));
            data.put("brands", named(read(shopClient.brands(id))));
            data.put("items", products(read(shopClient.products(id))));
            if (categoryId != null) data.put("categoryId", categoryId);
            if (brandId != null) data.put("brandId", brandId);
            if (productId != null) data.put("productId", productId);
            if (query != null && !query.isBlank()) data.put("query", query.strip());
            return data;
        });
    }

    @McpTool(
            name = "create_shop_order",
            title = "Place shop order",
            description = "Place a shop order after the visitor reviews their cart and taps Place order in the Salon shop app. This tool is only available to the embedded app UI, not to the assistant. It requires customerConfirmed=true.",
            annotations = @McpTool.McpAnnotations(readOnlyHint = false, destructiveHint = false, idempotentHint = false, openWorldHint = false),
            metaProvider = SalonMcpAppMeta.CreateOrderTool.class
    )
    McpSchema.CallToolResult createShopOrder(
            @McpToolParam(required = false, description = SalonMcpSupport.SALON_PARAM) String salonIdOrHandler,
            @McpToolParam(description = "Cart lines: variantId and quantity") List<OrderItem> items,
            @McpToolParam(description = "Visitor's name") String customerName,
            @McpToolParam(description = "Visitor's email address") String customerEmail,
            @McpToolParam(required = false, description = "Visitor's phone number") String customerPhone,
            @McpToolParam(required = false, description = "Shipping address line 1") String addressLine1,
            @McpToolParam(required = false, description = "Shipping address line 2") String addressLine2,
            @McpToolParam(required = false, description = "Shipping city") String city,
            @McpToolParam(required = false, description = "Shipping state or region") String state,
            @McpToolParam(required = false, description = "Shipping country") String country,
            @McpToolParam(required = false, description = "Shipping postal code") String zipCode,
            @McpToolParam(description = "Must be true only after the visitor taps Place order in the review view") Boolean customerConfirmed,
            McpTransportContext transport) {
        try {
            if (!Boolean.TRUE.equals(customerConfirmed)) {
                throw new IllegalArgumentException("The visitor must review and confirm the order first.");
            }
            if (customerName == null || customerName.isBlank() || customerEmail == null || customerEmail.isBlank()) {
                throw new IllegalArgumentException("Enter a name and an email address.");
            }
            var lines = items == null ? List.<SalonMcpShopClient.Item>of() : items.stream()
                    .filter(i -> i != null && i.variantId() != null && i.quantity() != null && i.quantity() > 0)
                    .map(i -> new SalonMcpShopClient.Item(i.variantId(), Math.min(i.quantity(), MAX_QUANTITY)))
                    .toList();
            if (lines.isEmpty()) throw new IllegalArgumentException("Your cart is empty.");
            SalonRef salon = shopSalon(salonIdOrHandler, transport);
            boolean hasAddress = blankToNull(addressLine1) != null || blankToNull(city) != null || blankToNull(zipCode) != null;
            var address = hasAddress ? new SalonMcpShopClient.Address(blankToNull(addressLine1), blankToNull(addressLine2),
                    blankToNull(city), blankToNull(state), blankToNull(country), blankToNull(zipCode)) : null;
            JsonNode body = read(shopClient.placeOrder(salon.id().toString(), new SalonMcpShopClient.CheckoutRequest(
                    customerName.strip(), customerEmail.strip(), blankToNull(customerPhone), address, lines, "ALL", null)));
            JsonNode order = body.has("order") ? body.path("order") : body;
            var orderLines = new ArrayList<Map<String, Object>>();
            order.path("lines").forEach(l -> orderLines.add(nullableMap(
                    "productName", l.path("productName").asText(""),
                    "variantLabel", text(l, "variantLabel"),
                    "quantity", l.path("quantity").asInt(),
                    "lineTotal", l.path("lineTotal").decimalValue())));
            var confirmation = nullableMap(
                    "orderId", order.path("id").isMissingNode() ? null : order.path("id").asLong(),
                    "orderNumber", text(order, "orderNumber"),
                    "status", text(order, "status"),
                    "paymentStatus", text(order, "paymentStatus"),
                    "subtotal", order.path("subtotal").isMissingNode() ? null : order.path("subtotal").decimalValue(),
                    "currency", text(order, "currency"),
                    "salonName", salon.salon().name(),
                    "lines", orderLines,
                    "checkoutUrl", text(body, "checkoutUrl"),
                    "message", body.has("checkoutUrl") ? "Order created. Complete payment to finish." : "Order placed.");
            return support.result(Map.of("app", SHOP, "view", "order-confirmation", "order", confirmation));
        } catch (IllegalArgumentException e) {
            return error(e.getMessage());
        } catch (RestClientResponseException e) {
            return error("We couldn't place that order. An item may have just sold out; please review your cart and try again.");
        } catch (org.springframework.web.server.ResponseStatusException e) {
            return error("Salon not found or unavailable.");
        } catch (Exception e) {
            return error("We couldn't place that order right now. Please try again.");
        }
    }

    private SalonRef shopSalon(String salonIdOrHandler, McpTransportContext transport) {
        SalonRef salon = support.activeSalon(salonIdOrHandler, transport);
        if (!salon.has(SalonFeature.WEBSHOP)) {
            throw new IllegalArgumentException("This salon doesn't have an online shop.");
        }
        return salon;
    }

    private JsonNode read(String json) {
        try {
            return objectMapper.readTree(json == null ? "[]" : json);
        } catch (Exception e) {
            throw new IllegalStateException("Unreadable shop response", e);
        }
    }

    private static List<Map<String, Object>> named(JsonNode array) {
        var result = new ArrayList<Map<String, Object>>();
        array.forEach(n -> result.add(nullableMap("id", n.path("id").asLong(), "name", n.path("name").asText(""),
                "logoUrl", text(n, "logoUrl"))));
        return result;
    }

    private static List<Map<String, Object>> products(JsonNode array) {
        var result = new ArrayList<Map<String, Object>>();
        array.forEach(p -> {
            var variants = new ArrayList<Map<String, Object>>();
            p.path("variants").forEach(v -> {
                if (!v.path("active").asBoolean(true)) return;
                int onHand = v.path("quantityOnHand").asInt(0);
                variants.add(nullableMap(
                        "id", v.path("id").asLong(),
                        "label", text(v, "label"),
                        "price", v.path("price").isMissingNode() || v.path("price").isNull() ? null : v.path("price").decimalValue(),
                        "compareAtPrice", v.path("compareAtPrice").isMissingNode() || v.path("compareAtPrice").isNull()
                                ? null : v.path("compareAtPrice").decimalValue(),
                        "currency", text(v, "currency"),
                        "maxQuantity", Math.max(0, Math.min(onHand, MAX_QUANTITY))));
            });
            if (variants.isEmpty()) return;
            var images = new ArrayList<String>();
            p.path("images").forEach(i -> { if (i.isTextual() && !i.asText().isBlank()) images.add(i.asText()); });
            if (images.isEmpty() && text(p, "imageUrl") != null) images.add(p.path("imageUrl").asText());
            result.add(nullableMap(
                    "id", p.path("id").asLong(),
                    "name", p.path("name").asText(""),
                    "description", p.path("description").asText(""),
                    "brandId", longOrNull(p, "brandId"),
                    "brandName", text(p, "brandName"),
                    "categoryId", longOrNull(p, "categoryId"),
                    "categoryName", text(p, "categoryName"),
                    "images", images,
                    "variants", variants));
        });
        return result;
    }

    private static Long longOrNull(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.asLong() : null;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() || value.asText().isBlank() ? null : value.asText();
    }
}
