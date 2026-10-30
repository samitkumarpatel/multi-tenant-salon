package net.samitkumar.multi_tenant_salon.shop;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Durable order messages. Notification owns transport; shop owns the audit and retry claims. */
public interface ShopCommunicationApi {
    record Message(String recipient, String recipientName, String subject, String text, String html, Long sourceActivityId, Long sourceLineActivityId) {
        public Message(String recipient, String recipientName, String subject, String text, String html) {
            this(recipient, recipientName, subject, text, html, null, null);
        }
        public Message(String recipient, String recipientName, String subject, String text, String html, Long sourceActivityId) {
            this(recipient, recipientName, subject, text, html, sourceActivityId, null);
        }
    }
    record Attempt(Long id, int generation, String status, String failureReason, Instant startedAt, Instant finishedAt) {}
    record Communication(Long id, Long activityId, Long sourceActivityId, Long sourceLineActivityId, String channel, String recipient, String subject, String body,
            String htmlBody, String status, String failureReason, int generation, int attempts,
            Instant createdAt, Instant updatedAt, List<Attempt> history) {}
    record Claimed(Long attemptId, Message message) {}

    void queue(UUID salonId, String orderNumber, Message message, boolean skipped);
    Claimed claim(UUID salonId, Long communicationId, int generation);
    /** Returns true when a temporary failure should be retried automatically. */
    boolean finish(UUID salonId, Long communicationId, Long attemptId, String status, String failureReason, boolean temporary);
    List<Communication> list(UUID salonId, Long orderId);
    void retry(UUID salonId, Long orderId, Long communicationId);
}
