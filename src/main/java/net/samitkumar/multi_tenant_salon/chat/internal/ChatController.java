package net.samitkumar.multi_tenant_salon.chat.internal;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
class ChatController {

    private final ChatAssistantService chatAssistantService;
    private final ChatFollowupsService chatFollowupsService;

    ChatController(ChatAssistantService chatAssistantService, ChatFollowupsService chatFollowupsService) {
        this.chatAssistantService = chatAssistantService;
        this.chatFollowupsService = chatFollowupsService;
    }

    record ChatTurnRequest(String role, String text) {}

    record ChatRequest(String context, String message, List<ChatTurnRequest> history) {}

    record ChatResponseBody(String reply, List<String> toolsUsed, PendingBooking pendingBooking, UiDirective ui) {}

    record ChatFollowupsRequest(String context, List<ChatTurnRequest> history) {}

    record ChatFollowupsResponseBody(List<String> followups) {}

    @PostMapping("/api/salon/{salonId}/chat")
    ChatResponseBody chat(@PathVariable String salonId, @RequestBody ChatRequest request) {
        var history = toTurns(request.history());
        var reply = chatAssistantService.reply(salonId, request.context(), request.message(), history);
        return new ChatResponseBody(reply.text(), reply.toolsUsed(), reply.pendingBooking(), reply.ui());
    }

    @PostMapping("/api/salon/{salonId}/chat/followups")
    ChatFollowupsResponseBody followups(@PathVariable String salonId, @RequestBody ChatFollowupsRequest request) {
        return new ChatFollowupsResponseBody(chatFollowupsService.followups(salonId, toTurns(request.history())));
    }

    private static List<ChatTurn> toTurns(List<ChatTurnRequest> history) {
        return (history == null ? List.<ChatTurnRequest>of() : history).stream()
                .map(turn -> new ChatTurn(turn.role(), turn.text()))
                .toList();
    }
}
