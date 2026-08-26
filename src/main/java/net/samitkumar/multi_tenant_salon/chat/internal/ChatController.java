package net.samitkumar.multi_tenant_salon.chat.internal;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
class ChatController {

    private final ChatAssistantService chatAssistantService;

    ChatController(ChatAssistantService chatAssistantService) {
        this.chatAssistantService = chatAssistantService;
    }

    record ChatTurnRequest(String role, String text) {}

    record ChatRequest(String context, String message, List<ChatTurnRequest> history) {}

    record ChatResponseBody(String reply, List<String> toolsUsed, PendingBooking pendingBooking) {}

    @PostMapping("/api/salon/{salonId}/chat")
    ChatResponseBody chat(@PathVariable String salonId, @RequestBody ChatRequest request) {
        var history = (request.history() == null ? List.<ChatTurnRequest>of() : request.history()).stream()
                .map(turn -> new ChatTurn(turn.role(), turn.text()))
                .toList();
        var reply = chatAssistantService.reply(salonId, request.context(), request.message(), history);
        return new ChatResponseBody(reply.text(), reply.toolsUsed(), reply.pendingBooking());
    }
}
