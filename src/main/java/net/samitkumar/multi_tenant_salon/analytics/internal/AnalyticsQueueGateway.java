package net.samitkumar.multi_tenant_salon.analytics.internal;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Slf4j
@Component
class AnalyticsQueueGateway {

    private final AnalyticsQueueClientProvider queueClientProvider;
    private final ObjectMapper objectMapper;

    AnalyticsQueueGateway(AnalyticsQueueClientProvider queueClientProvider, ObjectMapper objectMapper) {
        this.queueClientProvider = queueClientProvider;
        this.objectMapper = objectMapper;
    }

    void send(QueuedActivityEvent event) {
        if (!queueClientProvider.isEnabled()) {
            log.info("[Analytics] Azure Storage Queue not configured — logging event instead of enqueuing: {}", event);
            return;
        }
        try {
            String json = objectMapper.writeValueAsString(event);
            // Base64-encoded so arbitrary JSON content (quotes, unicode labels/paths) always
            // survives the queue message's XML transport, the same convention most Azure Queue
            // clients use by default.
            String encoded = Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
            queueClientProvider.get().sendMessage(encoded);
        } catch (Exception ex) {
            log.warn("[Analytics] Failed to enqueue activity event: {}", event, ex);
        }
    }
}
