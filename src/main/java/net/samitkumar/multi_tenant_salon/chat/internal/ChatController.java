package net.samitkumar.multi_tenant_salon.chat.internal;

import net.samitkumar.multi_tenant_salon.chat.GenUiEventType;
import net.samitkumar.multi_tenant_salon.chat.GenUiInteractionEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
class ChatController {

    private final ChatAssistantService chatAssistantService;
    private final ChatFollowupsService chatFollowupsService;
    private final ApplicationEventPublisher eventPublisher;

    ChatController(ChatAssistantService chatAssistantService, ChatFollowupsService chatFollowupsService,
                   ApplicationEventPublisher eventPublisher) {
        this.chatAssistantService = chatAssistantService;
        this.chatFollowupsService = chatFollowupsService;
        this.eventPublisher = eventPublisher;
    }

    /**
     * @param sessionId opaque per-visitor conversation key the frontend mints and reuses within
     *                  the memory TTL; server mints one when blank and echoes it back.
     * @param uiState   optional bracketed note describing what the visitor currently sees / is
     *                  doing on the page (picker step, on-screen card contents) — the model never
     *                  sees the live widgets, so this bridges that state into its memory.
     */
    record ChatRequest(String sessionId, String context, String message, String uiState) {}

    record ChatResponseBody(String sessionId, String message, List<UiComponent> components,
                            List<String> suggestedQuestions, List<String> toolsUsed,
                            PendingBooking pendingBooking) {}

    record ChatFollowupsRequest(String sessionId, String context, String uiState) {}

    record ChatFollowupsResponseBody(List<String> followups) {}

    @PostMapping("/api/salon/{salonId}/chat")
    ChatResponseBody chat(@PathVariable String salonId, @RequestBody ChatRequest request) {
        var sessionId = sessionId(request.sessionId());
        var reply = chatAssistantService.reply(
                salonId, conversationId(salonId, sessionId), request.context(), request.message(), request.uiState());
        publishUsageEvents(salonId, sessionId, reply);
        return new ChatResponseBody(sessionId, reply.message(), reply.components(), reply.suggestedQuestions(),
                reply.toolsUsed(), reply.pendingBooking());
    }

    /**
     * Fires one {@link GenUiInteractionEvent} per notable happening in this turn - the
     * {@code analytics} module listens and (only for salons with ANALYTICS enabled) records usage
     * the salon owner can see. Best-effort: this module never depends on whether anyone is
     * listening, so a listener failure can't affect the reply already returned to the visitor.
     */
    private void publishUsageEvents(String salonId, String sessionId, ChatReply reply) {
        var now = Instant.now();
        eventPublisher.publishEvent(new GenUiInteractionEvent(salonId, sessionId, GenUiEventType.MESSAGE_SENT, null, now));
        for (var component : reply.components()) {
            eventPublisher.publishEvent(new GenUiInteractionEvent(salonId, sessionId, GenUiEventType.COMPONENT_SHOWN, component.type(), now));
        }
        for (var tool : reply.toolsUsed()) {
            eventPublisher.publishEvent(new GenUiInteractionEvent(salonId, sessionId, GenUiEventType.TOOL_INVOKED, tool, now));
        }
        if (reply.pendingBooking() != null) {
            eventPublisher.publishEvent(new GenUiInteractionEvent(salonId, sessionId, GenUiEventType.BOOKING_PROPOSED, null, now));
        }
    }

    @PostMapping("/api/salon/{salonId}/chat/followups")
    ChatFollowupsResponseBody followups(@PathVariable String salonId, @RequestBody ChatFollowupsRequest request) {
        var conversationId = conversationId(salonId, sessionId(request.sessionId()));
        return new ChatFollowupsResponseBody(
                chatFollowupsService.followups(salonId, conversationId, request.uiState()));
    }

    private static String sessionId(String fromRequest) {
        return StringUtils.hasText(fromRequest) ? fromRequest : UUID.randomUUID().toString();
    }

    private static String conversationId(String salonId, String sessionId) {
        return salonId + ":" + sessionId;
    }
}
