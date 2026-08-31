package net.samitkumar.multi_tenant_salon.analytics.internal;

import com.azure.storage.queue.models.QueueMessageItem;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

@Slf4j
@Component
class AnalyticsQueueConsumer {

    private static final int MAX_MESSAGES_PER_POLL = 32;
    private static final Duration VISIBILITY_TIMEOUT = Duration.ofSeconds(30);

    private final AnalyticsQueueClientProvider queueClientProvider;
    private final AnalyticsEventRepository repository;
    private final ObjectMapper objectMapper;

    AnalyticsQueueConsumer(AnalyticsQueueClientProvider queueClientProvider,
                          AnalyticsEventRepository repository,
                          ObjectMapper objectMapper) {
        this.queueClientProvider = queueClientProvider;
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Scheduled(fixedDelayString = "${spring.application.analytics.poll-interval-ms:5000}")
    void poll() {
        if (!queueClientProvider.isEnabled()) {
            return;
        }
        var queueClient = queueClientProvider.get();
        for (QueueMessageItem message : queueClient.receiveMessages(MAX_MESSAGES_PER_POLL, VISIBILITY_TIMEOUT, null, null)) {
            try {
                String json = new String(Base64.getDecoder().decode(message.getMessageText()), StandardCharsets.UTF_8);
                QueuedActivityEvent event = objectMapper.readValue(json, QueuedActivityEvent.class);
                repository.save(new AnalyticsEvent(null, event.salonId(), event.eventType(), event.path(),
                        event.label(), event.sessionId(), event.occurredAt(), Instant.now()));
            } catch (Exception ex) {
                log.warn("[Analytics] Failed to process queued activity event, dropping it: {}", message.getMessageId(), ex);
            } finally {
                // Deleted whether processing succeeded or not — a message we can't parse will
                // never become parseable, so leaving it would just make it redeliver forever.
                queueClient.deleteMessage(message.getMessageId(), message.getPopReceipt());
            }
        }
    }
}
