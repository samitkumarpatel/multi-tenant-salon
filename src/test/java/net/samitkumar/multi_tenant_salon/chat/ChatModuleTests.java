package net.samitkumar.multi_tenant_salon.chat;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.context.WebApplicationContext;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.UUID;

@ApplicationModuleTest
@Import({TestcontainersConfiguration.class, ChatModuleTests.FakeChatModelConfig.class})
class ChatModuleTests {

    @Autowired
    WebApplicationContext context;

    @Test
    void chatEndpointReturnsAssistantReplyWithoutCallingRealAnthropicApi() {
        var client = RestTestClient.bindToApplicationContext(context).build();
        var salonId = UUID.randomUUID().toString();

        client.post()
                .uri("/api/salon/{salonId}/chat", salonId)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body("""
                        { "context": "website", "message": "What are your opening hours?", "history": [] }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.reply").isEqualTo("This is a fixed test reply.");
    }

    @Test
    void chatEndpointReturnsStagedPendingBookingWhenModelCallsProposeBookingTool() {
        var client = RestTestClient.bindToApplicationContext(context).build();
        var salonId = UUID.randomUUID().toString();

        client.post()
                .uri("/api/salon/{salonId}/chat", salonId)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body("""
                        { "context": "booking", "message": "TRIGGER_BOOKING_PROPOSAL please book it", "history": [] }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.pendingBooking.serviceId").isEqualTo(1)
                .jsonPath("$.pendingBooking.staffId").isEqualTo(2)
                .jsonPath("$.pendingBooking.appointmentDate").isEqualTo("2026-09-01")
                .jsonPath("$.pendingBooking.startTime").isEqualTo("10:00")
                .jsonPath("$.pendingBooking.customerName").isEqualTo("Jane Doe")
                .jsonPath("$.pendingBooking.customerEmail").isEqualTo("jane@example.com")
                .jsonPath("$.toolsUsed[0]").isEqualTo("booking-proposal");
    }

    @TestConfiguration
    static class FakeChatModelConfig {

        private static final String PROPOSE_BOOKING_ARGUMENTS = """
                {"serviceId":1,"staffId":2,"appointmentDate":"2026-09-01","startTime":"10:00",\
                "customerName":"Jane Doe","customerEmail":"jane@example.com","customerPhone":null,"notes":null}""";

        @Bean
        @Primary
        ChatModel fakeChatModel() {
            return new ChatModel() {
                @Override
                public ChatOptions getOptions() {
                    // Tool-calling only loops via ToolCallingAdvisor when the request's options
                    // are a ToolCallingChatOptions — a real model's options satisfy this; this
                    // fake must too, or tool calls the fake returns are never executed.
                    return ToolCallingChatOptions.builder().build();
                }

                @Override
                public ChatResponse call(Prompt prompt) {
                    boolean toolResultPresent = prompt.getInstructions().stream()
                            .anyMatch(m -> m instanceof ToolResponseMessage);
                    if (toolResultPresent) {
                        return new ChatResponse(List.of(new Generation(
                                new AssistantMessage("Great — I've staged your booking for you to confirm below."))));
                    }

                    boolean wantsBookingProposal = prompt.getInstructions().stream()
                            .anyMatch(m -> m.getText() != null && m.getText().contains("TRIGGER_BOOKING_PROPOSAL"));
                    if (wantsBookingProposal) {
                        var toolCall = new AssistantMessage.ToolCall("call-1", "function", "proposeBooking", PROPOSE_BOOKING_ARGUMENTS);
                        var assistantMessage = AssistantMessage.builder().content("").toolCalls(List.of(toolCall)).build();
                        return new ChatResponse(List.of(new Generation(assistantMessage)));
                    }

                    return new ChatResponse(List.of(new Generation(new AssistantMessage("This is a fixed test reply."))));
                }

                @Override
                public Flux<ChatResponse> stream(Prompt prompt) {
                    return Flux.just(call(prompt));
                }
            };
        }
    }
}
