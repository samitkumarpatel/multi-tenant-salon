package net.samitkumar.multi_tenant_salon.mcp.internal;

import io.modelcontextprotocol.common.McpTransportContext;
import io.modelcontextprotocol.json.jackson3.JacksonMcpJsonMapper;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import org.springframework.ai.mcp.server.common.autoconfigure.properties.McpServerStreamableHttpProperties;
import org.springframework.ai.mcp.server.webmvc.transport.WebMvcStreamableServerTransportProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

/**
 * Salon-specific MCP endpoints. Besides the shared {@code /mcp} endpoint (every tool takes
 * {@code salonIdOrHandler}), each salon has its own URL — {@code /mcp/{salonIdOrHandler}} — so a
 * visitor only pastes one URL into their AI app and never has to tell the assistant which salon.
 *
 * <p>There is still a single MCP server: a salon URL is forwarded to {@code /mcp} with the salon
 * recorded as a request attribute, and the transport's context extractor copies it into the
 * {@link McpTransportContext} every tool receives ({@link SalonMcpSupport#activeSalon}). Replaces
 * Spring AI's default transport bean (it is {@code @ConditionalOnMissingBean}) to add that extractor.
 */
@Configuration(proxyBeanMethods = false)
class SalonMcpTransportConfiguration {

    /** Transport-context key holding the salon UUID a salon-specific URL is bound to. */
    static final String SALON_CONTEXT_KEY = "salonId";
    private static final String SALON_ATTRIBUTE = SalonMcpTransportConfiguration.class.getName() + ".salonId";

    @Bean
    WebMvcStreamableServerTransportProvider webMvcStreamableServerTransportProvider(
            @Qualifier("mcpServerJsonMapper") JsonMapper jsonMapper,
            McpServerStreamableHttpProperties properties) {
        return WebMvcStreamableServerTransportProvider.builder()
                .jsonMapper(new JacksonMcpJsonMapper(jsonMapper))
                .mcpEndpoint(properties.getMcpEndpoint())
                .keepAliveInterval(properties.getKeepAliveInterval())
                .disallowDelete(properties.isDisallowDelete())
                .contextExtractor(request -> request.attribute(SALON_ATTRIBUTE)
                        .map(salonId -> McpTransportContext.create(Map.of(SALON_CONTEXT_KEY, salonId)))
                        .orElse(McpTransportContext.EMPTY))
                .build();
    }

    /**
     * {@code /mcp/{salon}} → forwarded to the shared MCP endpoint, tagged with that salon. A
     * forward (rather than rewriting the request inside a handler) makes the dispatcher resolve
     * the path afresh, so the transport's own {@code /mcp} routes handle it — including its
     * streaming responses and session handling.
     */
    @Bean
    FilterRegistrationBean<OncePerRequestFilter> salonScopedMcpFilter(McpServerStreamableHttpProperties properties,
                                                                     SalonApi salons) {
        String endpoint = properties.getMcpEndpoint();
        var filter = new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                    throws ServletException, IOException {
                String path = request.getRequestURI().substring(request.getContextPath().length());
                String salon = path.startsWith(endpoint + "/") ? path.substring(endpoint.length() + 1) : "";
                if (salon.endsWith("/")) salon = salon.substring(0, salon.length() - 1);
                if (salon.isEmpty() || salon.contains("/")) {
                    chain.doFilter(request, response);
                    return;
                }
                UUID salonId = activeSalonId(salons, URLDecoder.decode(salon, StandardCharsets.UTF_8));
                if (salonId == null) {
                    response.setStatus(HttpStatus.NOT_FOUND.value());
                    response.setContentType(MediaType.TEXT_PLAIN_VALUE);
                    response.setCharacterEncoding(StandardCharsets.UTF_8.name());
                    response.getWriter().write("No active salon matches this MCP URL. Copy the URL again from the salon's website.");
                    return;
                }
                request.setAttribute(SALON_ATTRIBUTE, salonId.toString());
                request.getRequestDispatcher(endpoint).forward(request, response);
            }
        };
        var registration = new FilterRegistrationBean<OncePerRequestFilter>(filter);
        registration.addUrlPatterns(endpoint + "/*");
        registration.setName("salonScopedMcpFilter");
        return registration;
    }

    private static UUID activeSalonId(SalonApi salons, String idOrHandler) {
        try {
            UUID id = salons.resolveId(idOrHandler);
            return salons.findById(id).filter(s -> s.status() == Salon.SalonStatus.ACTIVE).map(Salon::id).orElse(null);
        } catch (RuntimeException e) {
            return null;
        }
    }
}
