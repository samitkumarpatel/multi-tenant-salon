package net.samitkumar.multi_tenant_salon.chat.internal;

import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
class ChatController {

    private final ChatAssistantService chatAssistantService;
    private final ChatFollowupsService chatFollowupsService;

    ChatController(ChatAssistantService chatAssistantService, ChatFollowupsService chatFollowupsService) {
        this.chatAssistantService = chatAssistantService;
        this.chatFollowupsService = chatFollowupsService;
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
        return new ChatResponseBody(sessionId, reply.message(), reply.components(), reply.suggestedQuestions(),
                reply.toolsUsed(), reply.pendingBooking());
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
